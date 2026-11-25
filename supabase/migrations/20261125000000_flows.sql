-- Presenter flow: planned talk length per deck, fragment step synced to the stage,
-- and attendees keep reading the slides after the session ends (apostila).
alter table public.decks add column duration_min int not null default 45 check (duration_min between 1 and 600);
alter table public.sessions add column current_step int not null default 0 check (current_step >= 0);

drop policy decks_audience on public.decks;
create policy decks_audience on public.decks for select to authenticated using (
  exists (select 1 from public.sessions s where s.deck_id = decks.id and public.is_participant(s.id))
);
drop policy slides_audience on public.slides;
create policy slides_audience on public.slides for select to authenticated using (
  exists (select 1 from public.sessions s where s.deck_id = slides.deck_id and public.is_participant(s.id))
);
