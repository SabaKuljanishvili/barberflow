-- A deactivated team member loses all access, not just new bookings:
-- every RLS policy goes through these helpers, so an inactive profile no
-- longer resolves to a salon or to manager rights.
create or replace function public.current_salon_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select salon_id from public.profiles where id = (select auth.uid()) and active;
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'manager' and active
  );
$$;
