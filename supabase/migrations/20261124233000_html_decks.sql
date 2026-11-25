-- HTML decks (imported from Claude Slides): each slide keeps its markup and the deck keeps its shared CSS and
-- font links, so CSS/SVG animations and click reveals (fragments) survive. Image decks leave these empty.

alter table public.decks
  add column css text not null default '' check (char_length(css) <= 200000),
  add column fonts text[] not null default '{}' check (cardinality(fonts) <= 4);

alter table public.slides
  add column html text check (char_length(html) <= 200000);

-- the audience needs the deck CSS to draw HTML slides (decks hold no secrets; speaker notes stay in speaker_notes)
create policy decks_audience on public.decks for select to authenticated using (
  exists (select 1 from public.sessions s
          where s.deck_id = decks.id and s.status = 'live' and public.is_participant(s.id))
);
