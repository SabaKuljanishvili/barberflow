-- Past confirmed appointments used to stay "confirmed" forever, so revenue
-- (which counts completed visits) was always 0. A nightly job now marks
-- them completed, unless the salon prefers to review each visit by hand.
alter table public.salons
  add column auto_complete_appointments boolean not null default true;

grant update (auto_complete_appointments) on public.salons to authenticated;

create or replace function public.complete_past_appointments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  update public.appointments a
  set status = 'completed'
  from public.salons s
  where s.id = a.salon_id
    and s.auto_complete_appointments
    and a.status = 'confirmed'
    and a.ends_at < now();
  get diagnostics v_done = row_count;
  return v_done;
end;
$$;

revoke execute on function public.complete_past_appointments() from public, anon, authenticated;

-- Before the 03:15 archive run, so completed visits are archived with a price.
select cron.schedule('barberflow-complete-appointments', '5 3 * * *', $$select public.complete_past_appointments();$$);

-- Overview "needs review" card: past visits still pending/confirmed.
create index if not exists appointments_review_idx on public.appointments (salon_id, ends_at)
  where status in ('pending', 'confirmed');
