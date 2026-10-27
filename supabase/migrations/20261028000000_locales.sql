-- Bilingual support (Georgian / English).
--
-- salons.locale:  language the phone agent greets in and SMS texts use.
-- clients.locale: a caller's own choice (pressing 0 on the call); overrides
--                 the salon default for that caller's calls and texts.

alter table public.salons
  add column locale text not null default 'ka' check (locale in ('ka', 'en'));

alter table public.clients
  add column locale text check (locale is null or locale in ('ka', 'en'));

-- Signup now passes the site language the manager signed up in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_salon_name text := nullif(trim(new.raw_user_meta_data ->> 'salon_name'), '');
  v_full_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_locale text := case when new.raw_user_meta_data ->> 'locale' in ('ka', 'en') then new.raw_user_meta_data ->> 'locale' else 'ka' end;
begin
  if v_salon_name is null then
    return new;
  end if;

  insert into public.salons (name, locale) values (left(v_salon_name, 120), v_locale) returning id into v_salon_id;
  insert into public.profiles (id, salon_id, full_name, role, email)
  values (new.id, v_salon_id, left(v_full_name, 120), 'manager', new.email);
  return new;
end;
$$;
