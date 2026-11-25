-- Show Time: schema, RLS, RPCs, realtime and storage (plan F1, docs/PLANO-SUPABASE.md)

-- ───────────── tables ─────────────

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  slide_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.decks (owner_id);

create table public.slides (
  deck_id uuid not null references public.decks on delete cascade,
  idx int not null check (idx >= 0),
  title text not null default '',
  text text not null default '',
  stage_path text,
  mobile_path text,
  primary key (deck_id, idx)
);

-- separate from slides so the audience, which reads slides, never sees speaker notes
create table public.speaker_notes (
  deck_id uuid not null,
  idx int not null,
  body text not null default '',
  primary key (deck_id, idx),
  foreign key (deck_id, idx) references public.slides on delete cascade
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  pin char(6) not null check (pin ~ '^[0-9]{6}$'),
  status text not null default 'live' check (status in ('live', 'ended')),
  current_slide int not null default 0,
  free_nav boolean not null default true,
  moderation boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  peak_online int not null default 0
);
create unique index sessions_live_pin on public.sessions (pin) where status = 'live';
create index on public.sessions (owner_id);

create table public.participants (
  session_id uuid not null references public.sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index on public.participants (user_id);

create table public.questions (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  nickname text,  -- null = anonymous
  text text not null check (char_length(text) between 1 and 280),
  slide int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden', 'merged')),
  dup_of bigint references public.questions on delete set null,
  answered boolean not null default false,
  pinned boolean not null default false,
  upvote_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.questions (session_id, created_at);
create index on public.questions (author_id, created_at);

create table public.question_votes (
  question_id bigint not null references public.questions on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (question_id, user_id)
);

create table public.polls (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  options text[] not null check (cardinality(options) between 2 and 6),
  counts int[] not null default '{}',
  status text not null default 'idle' check (status in ('idle', 'open', 'closed')),
  on_stage boolean not null default false,
  slide int,
  created_at timestamptz not null default now()
);
create index on public.polls (session_id);

create table public.poll_votes (
  poll_id bigint not null references public.polls on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  option int not null check (option >= 0),
  primary key (poll_id, user_id)
);

create table public.notes (
  session_id uuid not null references public.sessions on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slide int not null,
  body text not null default '' check (char_length(body) <= 10000),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id, slide)
);

create table public.reaction_counts (
  session_id uuid not null references public.sessions on delete cascade,
  slide int not null,
  kind text not null check (kind in ('fogo', 'palmas', 'uau')),
  count int not null default 0,
  primary key (session_id, slide, kind)
);

-- ───────────── helpers (security definer: avoid RLS recursion between sessions/participants) ─────────────

create function public.is_session_owner(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions where id = sid and owner_id = auth.uid())
$$;

create function public.is_participant(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.participants where session_id = sid and user_id = auth.uid())
$$;

create function public.is_deck_owner(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.decks where id = did and owner_id = auth.uid())
$$;

create function public.is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- ───────────── RLS ─────────────

alter table public.decks enable row level security;
alter table public.slides enable row level security;
alter table public.speaker_notes enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.questions enable row level security;
alter table public.question_votes enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.notes enable row level security;
alter table public.reaction_counts enable row level security;

-- decks: owner only; creating decks requires a real (non-anonymous) account
create policy decks_select on public.decks for select to authenticated using (owner_id = auth.uid());
create policy decks_insert on public.decks for insert to authenticated
  with check (owner_id = auth.uid() and not public.is_anonymous());
create policy decks_update on public.decks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy decks_delete on public.decks for delete to authenticated using (owner_id = auth.uid());

-- slides: owner all; participants of a live session of the deck read
create policy slides_owner on public.slides for all to authenticated
  using (public.is_deck_owner(deck_id)) with check (public.is_deck_owner(deck_id));
create policy slides_audience on public.slides for select to authenticated using (
  exists (select 1 from public.sessions s
          where s.deck_id = slides.deck_id and s.status = 'live' and public.is_participant(s.id))
);

create policy speaker_notes_owner on public.speaker_notes for all to authenticated
  using (public.is_deck_owner(deck_id)) with check (public.is_deck_owner(deck_id));

-- sessions: created via create_session(); owner updates; owner + participants read
create policy sessions_select on public.sessions for select to authenticated
  using (owner_id = auth.uid() or public.is_participant(id));
create policy sessions_update on public.sessions for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- participants: created via join_session(); self + session owner read
create policy participants_select on public.participants for select to authenticated
  using (user_id = auth.uid() or public.is_session_owner(session_id));

-- questions
create policy questions_select on public.questions for select to authenticated using (
  public.is_session_owner(session_id)
  or (public.is_participant(session_id) and (status = 'approved' or author_id = auth.uid()))
);
create policy questions_insert on public.questions for insert to authenticated
  with check (author_id = auth.uid() and public.is_participant(session_id));
create policy questions_update on public.questions for update to authenticated
  using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));
create policy questions_delete on public.questions for delete to authenticated
  using (public.is_session_owner(session_id));

-- question_votes: own vote, on an approved question of a session you joined
create policy qv_select on public.question_votes for select to authenticated using (user_id = auth.uid());
create policy qv_insert on public.question_votes for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.questions q
    where q.id = question_id and q.status = 'approved' and public.is_participant(q.session_id))
);
create policy qv_delete on public.question_votes for delete to authenticated using (user_id = auth.uid());

-- polls: owner manages; participants read
create policy polls_select on public.polls for select to authenticated
  using (public.is_session_owner(session_id) or public.is_participant(session_id));
create policy polls_owner on public.polls for all to authenticated
  using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));

-- poll_votes: own vote, poll open, valid option
create policy pv_select on public.poll_votes for select to authenticated using (user_id = auth.uid());
create policy pv_insert on public.poll_votes for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.polls p
    where p.id = poll_id and p.status = 'open' and option < cardinality(p.options)
      and public.is_participant(p.session_id))
);

-- notes: own only
create policy notes_own on public.notes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (public.is_participant(session_id) or public.is_session_owner(session_id)));

-- reaction_counts: written by add_reactions(); owner reads
create policy rc_select on public.reaction_counts for select to authenticated
  using (public.is_session_owner(session_id));

-- no access for signed-out clients; anonymous sign-ins use the authenticated role
revoke all on all tables in schema public from anon;

-- ───────────── triggers ─────────────

-- questions: server decides status/flags, applies the 20 s cooldown per author
create function public.questions_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = new.session_id;
  if s.status <> 'live' then raise exception 'session ended'; end if;
  if exists (select 1 from public.questions
             where author_id = new.author_id and session_id = new.session_id
               and created_at > now() - interval '20 seconds') then
    raise exception 'cooldown' using errcode = 'P0001', hint = 'wait 20 seconds between questions';
  end if;
  new.status := case when s.moderation then 'pending' else 'approved' end;
  new.answered := false; new.pinned := false; new.upvote_count := 0; new.dup_of := null;
  new.created_at := now();
  return new;
end $$;
create trigger questions_before_insert before insert on public.questions
  for each row execute function public.questions_before_insert();

-- question_votes keep questions.upvote_count exact
create function public.question_votes_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.questions set upvote_count = upvote_count + 1 where id = new.question_id;
  else
    update public.questions set upvote_count = upvote_count - 1 where id = old.question_id;
  end if;
  return null;
end $$;
create trigger question_votes_count after insert or delete on public.question_votes
  for each row execute function public.question_votes_count();

-- polls: counts sized to options; poll_votes increment counts
create function public.polls_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.counts := array_fill(0, array[cardinality(new.options)]);
  return new;
end $$;
create trigger polls_before_insert before insert on public.polls
  for each row execute function public.polls_before_insert();

create function public.poll_votes_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.polls set counts[new.option + 1] = counts[new.option + 1] + 1 where id = new.poll_id;
  return null;
end $$;
create trigger poll_votes_count after insert on public.poll_votes
  for each row execute function public.poll_votes_count();

-- realtime: broadcast row changes to private topics
--   session:{id}       owner + participants (sessions, polls, approved questions)
--   session:{id}:host  owner only (every question change, reactions sent by clients)
create function public.broadcast_session_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  sid text := case when tg_table_name = 'sessions' then r ->> 'id' else r ->> 'session_id' end;
begin
  if tg_table_name = 'questions' then
    perform realtime.broadcast_changes('session:' || sid || ':host', tg_op, tg_op, tg_table_name, tg_table_schema, new, old);
    -- audience only hears about approved questions (and about one leaving approved)
    if coalesce(to_jsonb(new) ->> 'status', '') <> 'approved' and coalesce(to_jsonb(old) ->> 'status', '') <> 'approved' then
      return null;
    end if;
  end if;
  perform realtime.broadcast_changes('session:' || sid, tg_op, tg_op, tg_table_name, tg_table_schema, new, old);
  return null;
end $$;
create trigger sessions_broadcast after insert or update or delete on public.sessions
  for each row execute function public.broadcast_session_change();
create trigger questions_broadcast after insert or update or delete on public.questions
  for each row execute function public.broadcast_session_change();
create trigger polls_broadcast after insert or update or delete on public.polls
  for each row execute function public.broadcast_session_change();

-- realtime authorization (clients must use private channels: { config: { private: true } })
create function public.can_use_topic(t text, sending boolean, ext text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  p text[] := string_to_array(t, ':');
  sid uuid;
begin
  if p[1] is distinct from 'session' or cardinality(p) not in (2, 3)
     or p[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  sid := p[2]::uuid;
  if public.is_session_owner(sid) then return true; end if;
  if not public.is_participant(sid) then return false; end if;
  if cardinality(p) = 3 then
    return p[3] = 'host' and sending;  -- audience may send reactions to host, never listen
  end if;
  -- audience sends only presence on session:{id}; slide changes go through sessions.current_slide
  return not sending or ext = 'presence';
end $$;

create policy session_topics_receive on realtime.messages for select to authenticated
  using (public.can_use_topic(realtime.topic(), false, realtime.messages.extension));
create policy session_topics_send on realtime.messages for insert to authenticated
  with check (public.can_use_topic(realtime.topic(), true, realtime.messages.extension));

-- ───────────── RPCs ─────────────

create function public.create_session(p_deck_id uuid, p_free_nav boolean default true, p_moderation boolean default true)
returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; v_pin text;
begin
  if not public.is_deck_owner(p_deck_id) then raise exception 'not deck owner'; end if;
  loop
    v_pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into public.sessions (deck_id, owner_id, pin, free_nav, moderation)
      values (p_deck_id, auth.uid(), v_pin, p_free_nav, p_moderation)
      returning * into s;
      exit;
    exception when unique_violation then
      -- PIN taken by another live session: retry
    end;
  end loop;
  return s;
end $$;

create function public.join_session(p_pin text, p_nickname text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; v_pin text := regexp_replace(p_pin, '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into s from public.sessions where pin = v_pin and status = 'live';
  if not found then raise exception 'invalid pin' using errcode = 'P0002'; end if;
  insert into public.participants (session_id, user_id, nickname)
  values (s.id, auth.uid(), left(coalesce(nullif(btrim(p_nickname), ''), 'Anônimo'), 40))
  on conflict (session_id, user_id) do update set nickname = excluded.nickname;
  return jsonb_build_object('session_id', s.id, 'deck_id', s.deck_id, 'current_slide', s.current_slide,
                            'free_nav', s.free_nav, 'moderation', s.moderation);
end $$;

create function public.add_reactions(p_session_id uuid, p_slide int, p_kind text, p_n int)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_participant(p_session_id) then raise exception 'not a participant'; end if;
  insert into public.reaction_counts (session_id, slide, kind, count)
  values (p_session_id, p_slide, p_kind, least(greatest(p_n, 1), 50))  -- clamp a batch (~3 s of taps)
  on conflict (session_id, slide, kind) do update set count = public.reaction_counts.count + excluded.count;
end $$;

create function public.session_report(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = p_session_id and owner_id = auth.uid();
  if not found then raise exception 'not session owner'; end if;
  return jsonb_build_object(
    'session', to_jsonb(s),
    'kpis', jsonb_build_object(
      'participants', (select count(*) from public.participants where session_id = s.id),
      'peak_online', s.peak_online,
      'questions', (select count(*) from public.questions where session_id = s.id),
      'question_votes', (select count(*) from public.question_votes v join public.questions q on q.id = v.question_id where q.session_id = s.id),
      'reactions', (select coalesce(sum(count), 0) from public.reaction_counts where session_id = s.id),
      'notes_authors', (select count(distinct user_id) from public.notes where session_id = s.id and body <> ''),
      'duration_s', extract(epoch from coalesce(s.ended_at, now()) - s.started_at)::int),
    'per_slide', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slide', sl.idx, 'title', sl.title,
        'questions', (select count(*) from public.questions where session_id = s.id and slide = sl.idx),
        'reactions', (select coalesce(sum(count), 0) from public.reaction_counts where session_id = s.id and slide = sl.idx),
        'notes', (select count(*) from public.notes where session_id = s.id and slide = sl.idx and body <> '')
      ) order by sl.idx), '[]')
      from public.slides sl where sl.deck_id = s.deck_id),
    'polls', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'question', question, 'options', options, 'counts', counts, 'status', status) order by id), '[]')
              from public.polls where session_id = s.id),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'text', text, 'slide', slide,
                    'status', status, 'answered', answered, 'upvotes', upvote_count, 'created_at', created_at) order by upvote_count desc, id), '[]')
                  from public.questions where session_id = s.id)
  );
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_session(uuid, boolean, boolean), public.join_session(text, text),
  public.add_reactions(uuid, int, text, int), public.session_report(uuid) to authenticated;
grant execute on function public.is_session_owner(uuid), public.is_participant(uuid), public.is_deck_owner(uuid),
  public.is_anonymous(), public.can_use_topic(text, boolean, text) to authenticated;

-- ───────────── storage: public bucket of WebP slide images, path {deck_id}/{idx}_{stage|mob}.webp ─────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slides', 'slides', true, 5242880, array['image/webp']);

create policy slides_write on storage.objects for insert to authenticated
  with check (bucket_id = 'slides' and public.is_deck_owner(((storage.foldername(name))[1])::uuid));
create policy slides_update on storage.objects for update to authenticated
  using (bucket_id = 'slides' and public.is_deck_owner(((storage.foldername(name))[1])::uuid));
create policy slides_delete on storage.objects for delete to authenticated
  using (bucket_id = 'slides' and public.is_deck_owner(((storage.foldername(name))[1])::uuid));
