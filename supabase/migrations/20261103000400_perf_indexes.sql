-- Dashboard filters by status inside a time range (appointments list,
-- calendar, overview, header bell), and clients are paged by name.
create index if not exists appointments_salon_status_time_idx
  on public.appointments (salon_id, status, appointment_time);
create index if not exists call_logs_salon_outcome_created_idx
  on public.call_logs (salon_id, outcome, created_at desc);
