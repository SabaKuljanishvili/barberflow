-- Keep profiles.email in step with the sign-in email. Managers can now
-- change their email (Supabase confirms it first); the dashboard shows and
-- compares profiles.email, so copy the confirmed value over.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.sync_profile_email();
