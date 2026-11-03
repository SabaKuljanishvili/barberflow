-- Owners choose the order the voice agent reads services in (was
-- alphabetical) and can hide a service instead of deleting it, so past
-- appointments keep their service. Covered by the existing manager RLS
-- update policy on services (no column grants on this table).
alter table public.services
  add column sort_order integer not null default 0,
  add column active boolean not null default true;

update public.services s
set sort_order = o.rn
from (select id, row_number() over (partition by salon_id order by name) as rn from public.services) o
where o.id = s.id;

create index if not exists services_salon_order_idx on public.services (salon_id, active, sort_order);
