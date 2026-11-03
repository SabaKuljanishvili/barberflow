-- Team management: a deactivated barber keeps their history but disappears
-- from booking and the voice agent; a manager can choose not to take
-- clients. Changed only by managers through server actions that use the
-- service role after a manager check, so no new column grants are needed.
alter table public.profiles
  add column active boolean not null default true,
  add column takes_clients boolean not null default true;

create index if not exists profiles_salon_bookable_idx on public.profiles (salon_id) where active and takes_clients;
