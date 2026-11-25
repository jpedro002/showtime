-- where the PIN/QR badge sits on the projected slide, as a fraction of the free space (0,0 = top-left; 1,0 = top-right)
alter table public.sessions
  add column badge_x real not null default 1 check (badge_x between 0 and 1),
  add column badge_y real not null default 0 check (badge_y between 0 and 1);
