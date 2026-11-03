-- The web voice agent logs each browser session with call_status 'web'
-- (lib/voice/web-flow.ts), but the check constraint from
-- 20261027120000 only allowed Twilio statuses, so every web session insert
-- failed with 23514 and the agent answered "Something went wrong".
alter table public.call_logs drop constraint if exists call_logs_call_status_check;
alter table public.call_logs
  add constraint call_logs_call_status_check
  check (call_status in ('queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled', 'web'));
