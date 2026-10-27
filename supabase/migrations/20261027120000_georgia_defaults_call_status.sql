-- Georgia defaults and call analytics from Twilio status callbacks.

-- New shops start on Tbilisi time. Shops still on the old UTC default have
-- never chosen a timezone, so move them too. Africa/Abidjan is included
-- because the old settings form fell back to it (first entry in the list)
-- whenever the stored value was UTC, so saving settings wrote it silently.
alter table public.salons alter column timezone set default 'Asia/Tbilisi';
update public.salons set timezone = 'Asia/Tbilisi' where timezone in ('UTC', 'Africa/Abidjan');

-- Filled by /api/voice/status when Twilio reports the call's final state.
alter table public.call_logs
  add column call_status      text check (call_status in ('queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled')),
  add column duration_seconds integer check (duration_seconds >= 0),
  add column ended_at         timestamptz;
