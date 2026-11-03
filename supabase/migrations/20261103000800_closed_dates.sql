-- Holidays / closed days (salon-local dates). Booking, the calendar and
-- the voice agents skip them. Written by the Settings form, so it needs a
-- column grant (see salon-grants.test.ts).
alter table public.salons
  add column closed_dates date[] not null default '{}';

grant update (closed_dates) on public.salons to authenticated;
