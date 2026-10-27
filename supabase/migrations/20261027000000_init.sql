-- BarberFlow initial schema
-- Multi-tenant: every tenant-owned row carries salon_id, and RLS scopes all
-- access to the caller's salon. Composite foreign keys (id, salon_id) make it
-- impossible for an appointment to reference a client/service/barber that
-- belongs to another salon, even via the service role.

create extension if not exists btree_gist;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('manager', 'barber');
create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
create type public.call_outcome as enum ('booked', 'abandoned', 'no_availability', 'error');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.salons (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 120),
  subscription_status public.subscription_status not null default 'trialing',
  -- Twilio virtual number (E.164) that inbound calls are forwarded to.
  phone_number        text unique check (phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  timezone            text not null default 'UTC',
  opens_at            time not null default '09:00',
  closes_at           time not null default '19:00',
  -- ISO weekday numbers, 1 = Monday ... 7 = Sunday
  working_days        smallint[] not null default '{1,2,3,4,5,6}',
  voice_agent_enabled boolean not null default true,
  created_at          timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  salon_id   uuid not null references public.salons (id) on delete cascade,
  full_name  text not null check (char_length(full_name) between 1 and 120),
  role       public.staff_role not null default 'barber',
  email      text not null,
  phone      text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  unique (id, salon_id)
);

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references public.salons (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  price            numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  created_at       timestamptz not null default now(),
  unique (id, salon_id),
  unique (salon_id, name)
);

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons (id) on delete cascade,
  first_name   text not null default '' check (char_length(first_name) <= 60),
  last_name    text not null default '' check (char_length(last_name) <= 60),
  phone_number text not null check (phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  created_at   timestamptz not null default now(),
  unique (id, salon_id),
  unique (salon_id, phone_number)
);

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references public.salons (id) on delete cascade,
  client_id        uuid not null,
  staff_id         uuid not null,
  service_id       uuid not null,
  appointment_time timestamptz not null,
  -- Derived from the service duration by trigger; used for overlap checks.
  ends_at          timestamptz not null,
  status           public.appointment_status not null default 'pending',
  reminder_sent_at timestamptz,
  source           text not null default 'dashboard' check (source in ('dashboard', 'voice')),
  created_at       timestamptz not null default now(),
  foreign key (client_id, salon_id) references public.clients (id, salon_id) on delete cascade,
  foreign key (staff_id, salon_id) references public.profiles (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete restrict,
  check (ends_at > appointment_time),
  -- A barber can never be double booked by active appointments.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(appointment_time, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

-- Cold storage for the retention job. No FKs so parents can be deleted freely.
create table public.appointments_archive (
  id               uuid primary key,
  salon_id         uuid not null,
  client_id        uuid,
  staff_id         uuid,
  service_id       uuid,
  appointment_time timestamptz not null,
  ends_at          timestamptz not null,
  status           public.appointment_status not null,
  source           text not null,
  price            numeric(10, 2),
  created_at       timestamptz not null,
  archived_at      timestamptz not null default now()
);

create table public.call_logs (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references public.salons (id) on delete cascade,
  call_sid       text not null unique,
  from_number    text not null,
  client_id      uuid references public.clients (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  outcome        public.call_outcome not null default 'abandoned',
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (FK columns and hot query paths)
-- ---------------------------------------------------------------------------
create index profiles_salon_idx on public.profiles (salon_id);
create index services_salon_idx on public.services (salon_id);
create index clients_salon_created_idx on public.clients (salon_id, created_at desc);
create index clients_name_search_idx on public.clients (salon_id, lower(last_name), lower(first_name));
create index appointments_salon_time_idx on public.appointments (salon_id, appointment_time);
create index appointments_staff_time_idx on public.appointments (staff_id, appointment_time);
create index appointments_client_idx on public.appointments (client_id);
create index appointments_service_idx on public.appointments (service_id);
create index appointments_reminder_due_idx on public.appointments (appointment_time)
  where reminder_sent_at is null and status in ('pending', 'confirmed');
create index appointments_archive_salon_time_idx on public.appointments_archive (salon_id, appointment_time);
create index call_logs_salon_created_idx on public.call_logs (salon_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_appointment_ends_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration integer;
begin
  select duration_minutes into v_duration
  from public.services
  where id = new.service_id and salon_id = new.salon_id;

  if v_duration is null then
    raise exception 'Service % not found for salon', new.service_id;
  end if;

  new.ends_at := new.appointment_time + make_interval(mins => v_duration);
  return new;
end;
$$;

create trigger appointments_set_ends_at
before insert or update of appointment_time, service_id on public.appointments
for each row execute function public.set_appointment_ends_at();

-- Self-service signup creates a salon and its first manager. Invited barbers
-- carry no salon_name; their profile is inserted server-side by the inviting
-- manager's action (service role), so metadata can never pick a salon_id.
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
begin
  if v_salon_name is null then
    return new;
  end if;

  insert into public.salons (name) values (left(v_salon_name, 120)) returning id into v_salon_id;
  insert into public.profiles (id, salon_id, full_name, role, email)
  values (new.id, v_salon_id, left(v_full_name, 120), 'manager', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers. SECURITY DEFINER avoids recursive policy evaluation on profiles.
-- ---------------------------------------------------------------------------
create or replace function public.current_salon_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select salon_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'manager'
  );
$$;

revoke execute on function public.current_salon_id() from public, anon;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.current_salon_id() to authenticated;
grant execute on function public.is_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.salons enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointments_archive enable row level security;
alter table public.call_logs enable row level security;

-- Anonymous users get nothing at the table level.
revoke all on all tables in schema public from anon;

-- salons
create policy "salon members read own salon" on public.salons
  for select to authenticated using (id = (select public.current_salon_id()));
create policy "managers update own salon" on public.salons
  for update to authenticated
  using (id = (select public.current_salon_id()) and (select public.is_manager()))
  with check (id = (select public.current_salon_id()));
-- subscription_status is billing-owned: only the service role may change it.
revoke update on public.salons from authenticated;
grant update (name, phone_number, timezone, opens_at, closes_at, working_days, voice_agent_enabled)
  on public.salons to authenticated;

-- profiles (inserts/deletes happen only through the service role)
create policy "salon members read colleagues" on public.profiles
  for select to authenticated using (salon_id = (select public.current_salon_id()));
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- role, salon_id and email are never user-editable.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- services
create policy "salon members read services" on public.services
  for select to authenticated using (salon_id = (select public.current_salon_id()));
create policy "managers insert services" on public.services
  for insert to authenticated
  with check (salon_id = (select public.current_salon_id()) and (select public.is_manager()));
create policy "managers update services" on public.services
  for update to authenticated
  using (salon_id = (select public.current_salon_id()) and (select public.is_manager()))
  with check (salon_id = (select public.current_salon_id()));
create policy "managers delete services" on public.services
  for delete to authenticated
  using (salon_id = (select public.current_salon_id()) and (select public.is_manager()));

-- clients
create policy "salon members read clients" on public.clients
  for select to authenticated using (salon_id = (select public.current_salon_id()));
create policy "salon members insert clients" on public.clients
  for insert to authenticated with check (salon_id = (select public.current_salon_id()));
create policy "salon members update clients" on public.clients
  for update to authenticated
  using (salon_id = (select public.current_salon_id()))
  with check (salon_id = (select public.current_salon_id()));
create policy "managers delete clients" on public.clients
  for delete to authenticated
  using (salon_id = (select public.current_salon_id()) and (select public.is_manager()));

-- appointments: managers see/manage all; barbers manage their own chair.
create policy "salon members read appointments" on public.appointments
  for select to authenticated using (salon_id = (select public.current_salon_id()));
create policy "staff insert appointments" on public.appointments
  for insert to authenticated
  with check (
    salon_id = (select public.current_salon_id())
    and ((select public.is_manager()) or staff_id = (select auth.uid()))
  );
create policy "staff update appointments" on public.appointments
  for update to authenticated
  using (
    salon_id = (select public.current_salon_id())
    and ((select public.is_manager()) or staff_id = (select auth.uid()))
  )
  with check (
    salon_id = (select public.current_salon_id())
    and ((select public.is_manager()) or staff_id = (select auth.uid()))
  );
create policy "managers delete appointments" on public.appointments
  for delete to authenticated
  using (salon_id = (select public.current_salon_id()) and (select public.is_manager()));

-- archive and call logs are read-only to managers; writes come from the server.
create policy "managers read archive" on public.appointments_archive
  for select to authenticated
  using (salon_id = (select public.current_salon_id()) and (select public.is_manager()));
create policy "salon members read call logs" on public.call_logs
  for select to authenticated using (salon_id = (select public.current_salon_id()));

-- ---------------------------------------------------------------------------
-- Data retention: move finished appointments older than one month to the
-- archive table, and drop archive rows older than 13 months.
-- ---------------------------------------------------------------------------
create or replace function public.archive_old_appointments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moved integer;
begin
  with moved as (
    delete from public.appointments a
    where a.appointment_time < now() - interval '1 month'
      and (a.status in ('completed', 'cancelled') or a.ends_at < now() - interval '1 month')
    returning a.*
  )
  insert into public.appointments_archive
    (id, salon_id, client_id, staff_id, service_id, appointment_time, ends_at, status, source, price, created_at)
  select m.id, m.salon_id, m.client_id, m.staff_id, m.service_id, m.appointment_time, m.ends_at,
         m.status, m.source, s.price, m.created_at
  from moved m
  left join public.services s on s.id = m.service_id
  on conflict (id) do nothing;

  get diagnostics v_moved = row_count;

  delete from public.appointments_archive where appointment_time < now() - interval '13 months';
  delete from public.call_logs where created_at < now() - interval '3 months';

  return v_moved;
end;
$$;

revoke execute on function public.archive_old_appointments() from public, anon, authenticated;

-- Nightly at 03:15 UTC.
select cron.schedule('barberflow-archive-appointments', '15 3 * * *', $$select public.archive_old_appointments();$$);
