-- ARMEN Care — schema, role-based access (RLS), storage and realtime.
-- Roles: owner (customer) · technician · admin. Role lives in public.profiles.role.


-- =========================================================================
-- Profiles (1:1 with auth.users)
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  role text not null default 'owner' check (role in ('owner', 'technician', 'admin')),
  language text not null default 'hy' check (language in ('hy', 'en', 'ru')),
  region text check (region in ('Aragatsotn', 'Yerevan')),
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  notify_warning boolean not null default true,
  notify_info boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'owner')  -- app_meta_data is only writable server-side
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Core asset tables
-- =========================================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'home' check (kind in ('home', 'business')),
  phone text,
  email text,
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  size text not null check (size in ('S30', 'M60', 'L100')),
  model text not null,
  serial text not null unique,
  install_date date not null,
  warranty_end date not null,
  address text not null,
  community text not null,
  region text not null check (region in ('Aragatsotn', 'Yerevan')),
  lat double precision not null,
  lng double precision not null,
  pv_kwp numeric not null default 0,
  technician_id uuid references public.profiles (id) on delete set null,
  operating_mode text not null default 'self_consumption' check (operating_mode in ('self_consumption', 'backup_reserve')),
  backup_reserve_pct int not null default 20 check (backup_reserve_pct between 0 and 90),
  tariff_amd numeric not null default 48,
  export_tariff_amd numeric not null default 30,
  last_service_date date,
  next_service_date date,
  last_seen_at timestamptz,
  device_key_hash text, -- sha256 of the gateway API key (never store the key itself)
  created_at timestamptz not null default now()
);
create index on public.stations (customer_id);
create index on public.stations (technician_id);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  station_id uuid references public.stations (id) on delete set null,
  "row" int,
  slot int,
  grade text not null check (grade in ('A', 'B', 'C')),
  status text not null default 'spare' check (status in ('active', 'faulty', 'replaced', 'spare')),
  install_date date,
  manufacture_date date not null,
  origin text not null default '',
  initial_soh numeric not null,
  created_at timestamptz not null default now()
);
create unique index modules_position_uq on public.modules (station_id, "row", slot) where station_id is not null;

-- full traceability: every time a module is placed in / removed from a station
create table public.module_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  "row" int not null,
  slot int not null,
  installed_at timestamptz not null default now(),
  removed_at timestamptz,
  grade_at_install text not null,
  soh_at_install numeric not null,
  soh_at_removal numeric,
  removal_reason text,
  work_order_id uuid
);
create index on public.module_assignments (module_id);
create index on public.module_assignments (station_id);

-- =========================================================================
-- Telemetry
-- station-level rows have module_id = null; module rows have module_id set.
-- =========================================================================
create table public.telemetry (
  id bigint generated always as identity primary key,
  station_id uuid not null references public.stations (id) on delete cascade,
  module_id uuid references public.modules (id) on delete cascade,
  ts timestamptz not null,
  soc numeric,
  soh numeric,
  voltage numeric,
  current numeric,
  temperature numeric,          -- module temp, or max module temp for station rows
  coolant_in_temp numeric,
  coolant_out_temp numeric,
  -- station rows only
  pv_kw numeric,
  load_kw numeric,
  grid_kw numeric,              -- + import / - export
  battery_kw numeric,           -- + charging / - discharging
  mode text,
  temp_avg numeric,
  cell_spread_mv numeric,
  cycles numeric,
  systems jsonb,
  -- module rows only
  cell_min_mv int,
  cell_max_mv int,
  bms_fault text
);
create index telemetry_station_ts on public.telemetry (station_id, ts desc) where module_id is null;
create index telemetry_module_ts on public.telemetry (module_id, ts desc) where module_id is not null;

-- latest snapshot per station (upserted by the ingest function; realtime source for dashboards)
create table public.station_latest (
  station_id uuid primary key references public.stations (id) on delete cascade,
  ts timestamptz not null,
  snapshot jsonb not null,
  modules jsonb not null default '[]'::jsonb
);

-- daily roll-ups for 12-month charts and energy reports
create table public.station_daily (
  station_id uuid not null references public.stations (id) on delete cascade,
  day date not null,
  charged_kwh numeric not null default 0,
  discharged_kwh numeric not null default 0,
  solar_kwh numeric not null default 0,
  load_kwh numeric not null default 0,
  grid_import_kwh numeric not null default 0,
  grid_export_kwh numeric not null default 0,
  self_consumption_pct numeric not null default 0,
  savings_amd numeric not null default 0,
  soh numeric,
  cycles numeric,
  temp_max numeric,
  temp_avg numeric,
  spread_mv numeric,
  primary key (station_id, day)
);

create table public.module_daily (
  module_id uuid not null references public.modules (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete cascade,
  day date not null,
  soh numeric,
  temp_max numeric,
  spread_mv numeric,
  primary key (module_id, day)
);

-- =========================================================================
-- Alerts
-- =========================================================================
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('threshold', 'event')),
  metric text,
  operator text check (operator in ('>', '<')),
  warning_threshold numeric,
  critical_threshold numeric,
  event_severity text check (event_severity in ('info', 'warning', 'critical')),
  unit text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  code text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  notified_at timestamptz
);
create index on public.alerts (station_id, created_at desc);
create unique index alerts_one_open_per_key on public.alerts (station_id, code, coalesce(module_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status <> 'resolved';

-- =========================================================================
-- Maintenance
-- =========================================================================
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  number int unique, -- set by trigger: WO-1001, WO-1002 …
  station_id uuid not null references public.stations (id) on delete cascade,
  type text not null check (type in ('inspection_6m', 'annual_coolant_fire', 'repair', 'module_replacement', 'commissioning')),
  issue_type text check (issue_type in ('alert', 'performance', 'noise', 'physical_damage', 'app_data', 'other')),
  title text not null,
  description text not null default '',
  status text not null default 'new' check (status in ('new', 'scheduled', 'in_progress', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  preferred_date date,
  scheduled_date date,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  photos text[] not null default '{}',
  parts_used jsonb not null default '[]'::jsonb,
  signature_url text,
  signed_by text,
  alert_id uuid references public.alerts (id) on delete set null,
  resolution_notes text
);
create index on public.work_orders (station_id);
create index on public.work_orders (assigned_to);
alter table public.module_assignments add constraint module_assignments_wo_fk foreign key (work_order_id) references public.work_orders (id) on delete set null;

create table public.checklist_templates (
  service_type text not null,
  position int not null,
  label_key text not null,
  primary key (service_type, position)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  position int not null,
  label_key text not null,
  done boolean not null default false,
  note text
);
create index on public.checklist_items (work_order_id);

create table public.service_history (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  work_order_id uuid references public.work_orders (id) on delete set null,
  date date not null,
  type text not null,
  summary text not null,
  technician_id uuid references public.profiles (id) on delete set null
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  kind text not null check (kind in ('warranty', 'installation_certificate', 'manual', 'safety_manual', 'service_report')),
  title text not null,
  storage_path text, -- path inside the "documents" bucket: <station_id>/<file>
  created_at timestamptz not null default now(),
  size_kb int not null default 0
);

create table public.event_log (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  ts timestamptz not null default now(),
  source text not null check (source in ('bms', 'pcs', 'fire', 'cooling', 'system', 'user')),
  code text not null,
  message text not null default ''
);
create index on public.event_log (station_id, ts desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Access helpers (security definer → no RLS recursion)
-- =========================================================================
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'technician') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_see_station(p_station uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'admin' then true
    when 'technician' then exists (select 1 from public.stations s where s.id = p_station and s.technician_id = auth.uid())
    when 'owner' then exists (
      select 1 from public.stations s join public.customers c on c.id = s.customer_id
      where s.id = p_station and c.owner_id = auth.uid())
    else false
  end
$$;

-- =========================================================================
-- Guard triggers (column-level rules that RLS cannot express)
-- =========================================================================
create or replace function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if not public.is_admin() and (new.role is distinct from old.role or new.email is distinct from old.email) then
    raise exception 'Only admins can change role or email';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.guard_station_update() returns trigger
language plpgsql as $$
begin
  if public.my_role() = 'owner' then
    -- owners may only change their operating preferences
    if (to_jsonb(new) - 'operating_mode' - 'backup_reserve_pct') is distinct from (to_jsonb(old) - 'operating_mode' - 'backup_reserve_pct') then
      raise exception 'Owners can only change operating mode and backup reserve';
    end if;
  end if;
  return new;
end $$;
create trigger stations_guard before update on public.stations for each row execute function public.guard_station_update();

create or replace function public.guard_alert_update() returns trigger
language plpgsql as $$
begin
  if public.my_role() = 'owner' and (new.status not in ('open', 'acknowledged') or (to_jsonb(new) - 'status' - 'acknowledged_at') is distinct from (to_jsonb(old) - 'status' - 'acknowledged_at')) then
    raise exception 'Owners can only acknowledge alerts';
  end if;
  if new.status = 'acknowledged' and old.status <> 'acknowledged' then new.acknowledged_at := coalesce(new.acknowledged_at, now()); end if;
  if new.status = 'resolved' and old.status <> 'resolved' then new.resolved_at := coalesce(new.resolved_at, now()); end if;
  return new;
end $$;
create trigger alerts_guard before update on public.alerts for each row execute function public.guard_alert_update();

-- owners can create service requests, but only as "new" and unassigned
create or replace function public.guard_work_order_insert() returns trigger
language plpgsql as $$
begin
  if public.my_role() = 'owner' then
    new.status := 'new';
    new.assigned_to := null;
    new.scheduled_date := null;
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
create trigger work_orders_guard_insert before insert on public.work_orders for each row execute function public.guard_work_order_insert();

create or replace function public.work_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('work_order_number'));
    select coalesce(max(number), 1000) + 1 into new.number from public.work_orders;
  end if;
  return new;
end $$;
create trigger work_orders_number before insert on public.work_orders for each row execute function public.work_order_number();

-- copy checklist template into new work orders
create or replace function public.work_order_checklist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.checklist_items (work_order_id, position, label_key)
  select new.id, t.position, t.label_key from public.checklist_templates t where t.service_type = new.type;
  return new;
end $$;
create trigger work_orders_checklist after insert on public.work_orders for each row execute function public.work_order_checklist();

-- completing a work order writes service history, moves the service schedule and resolves the linked alert
create or replace function public.work_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'scheduled' and new.scheduled_date is null then
    new.scheduled_date := current_date;
  end if;
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := coalesce(new.completed_at, now());
    insert into public.service_history (station_id, work_order_id, date, type, summary, technician_id)
    values (new.station_id, new.id, new.completed_at::date, new.type, coalesce(nullif(new.resolution_notes, ''), new.title), new.assigned_to);
    if new.type in ('inspection_6m', 'annual_coolant_fire') then
      update public.stations set last_service_date = new.completed_at::date, next_service_date = (new.completed_at + interval '6 months')::date where id = new.station_id;
    end if;
    if new.alert_id is not null then
      update public.alerts set status = 'resolved', resolved_at = now() where id = new.alert_id and status <> 'resolved';
    end if;
    insert into public.event_log (station_id, source, code, message) values (new.station_id, 'user', 'SERVICE_COMPLETED', 'WO-' || new.number);
  end if;
  return new;
end $$;
create trigger work_orders_status before update on public.work_orders for each row execute function public.work_order_status_change();

-- =========================================================================
-- RPCs
-- =========================================================================
create or replace function public.replace_module(
  p_faulty uuid, p_new_serial text, p_grade text, p_soh numeric, p_reason text, p_work_order uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_old public.modules;
  v_new public.modules;
  v_soh numeric;
begin
  select * into v_old from public.modules where id = p_faulty for update;
  if v_old.id is null or v_old.station_id is null then raise exception 'Module is not installed'; end if;
  if not (public.is_staff() and public.can_see_station(v_old.station_id)) then raise exception 'Not allowed'; end if;

  select soh into v_soh from public.telemetry where module_id = p_faulty order by ts desc limit 1;
  update public.module_assignments set removed_at = now(), soh_at_removal = v_soh, removal_reason = p_reason, work_order_id = p_work_order
    where module_id = p_faulty and removed_at is null;
  update public.modules set status = 'replaced', station_id = null, "row" = null, slot = null where id = p_faulty;

  select * into v_new from public.modules where lower(serial) = lower(trim(p_new_serial)) for update;
  if v_new.id is not null and v_new.station_id is not null then raise exception 'serial_in_use'; end if;
  if v_new.id is null then
    insert into public.modules (serial, grade, status, manufacture_date, origin, initial_soh)
    values (trim(p_new_serial), p_grade, 'spare', current_date, 'Registered at replacement', p_soh) returning * into v_new;
  end if;
  update public.modules set station_id = v_old.station_id, "row" = v_old."row", slot = v_old.slot, status = 'active',
    grade = p_grade, install_date = current_date, initial_soh = p_soh where id = v_new.id;
  insert into public.module_assignments (module_id, station_id, "row", slot, grade_at_install, soh_at_install, work_order_id)
    values (v_new.id, v_old.station_id, v_old."row", v_old.slot, p_grade, p_soh, p_work_order);
  update public.alerts set status = 'resolved', resolved_at = now() where module_id = p_faulty and status <> 'resolved';
  insert into public.event_log (station_id, source, code, message)
    values (v_old.station_id, 'user', 'MODULE_REPLACED', v_old."row" || '-' || v_old.slot || ': ' || v_old.serial || ' → ' || v_new.serial);
  return v_new.id;
end $$;

-- bucketed history (RLS applies through security invoker)
create or replace function public.station_history(p_station uuid, p_range text)
returns table (ts timestamptz, soh numeric, cycles numeric, temp_max numeric, temp_avg numeric, spread_mv numeric)
language sql stable security invoker set search_path = public as $$
  select (d.day + time '12:00') at time zone 'Asia/Yerevan', d.soh, d.cycles, d.temp_max, d.temp_avg, d.spread_mv
    from public.station_daily d
   where p_range = '12m' and d.station_id = p_station and d.day >= current_date - 365
  union all
  select date_bin(case when p_range = '7d' then interval '1 hour' else interval '4 hours' end, t.ts, timestamptz '2020-01-01'),
         round(avg(t.soh), 2), max(t.cycles), max(t.temperature), round(avg(t.temp_avg), 1), max(t.cell_spread_mv)
    from public.telemetry t
   where p_range in ('7d', '30d') and t.station_id = p_station and t.module_id is null
     and t.ts >= now() - case when p_range = '7d' then interval '7 days' else interval '30 days' end
   group by 1
  order by 1
$$;

create or replace function public.module_history(p_module uuid, p_range text)
returns table (ts timestamptz, soh numeric, temp_max numeric, spread_mv numeric, soc numeric, voltage numeric)
language sql stable security invoker set search_path = public as $$
  select (d.day + time '12:00') at time zone 'Asia/Yerevan', d.soh, d.temp_max, d.spread_mv, null::numeric, null::numeric
    from public.module_daily d
   where p_range = '12m' and d.module_id = p_module and d.day >= current_date - 365
  union all
  select date_bin(case when p_range = '7d' then interval '1 hour' else interval '4 hours' end, t.ts, timestamptz '2020-01-01'),
         round(avg(t.soh), 2), max(t.temperature), max(t.cell_max_mv - t.cell_min_mv), round(avg(t.soc), 1), round(avg(t.voltage), 2)
    from public.telemetry t
   where p_range in ('7d', '30d') and t.module_id = p_module
     and t.ts >= now() - case when p_range = '7d' then interval '7 days' else interval '30 days' end
   group by 1
  order by 1
$$;

-- raises COMM_LOST alerts for stations that stopped reporting (schedule with pg_cron, see README)
create or replace function public.check_comm_lost() returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_rule public.alert_rules; v_min numeric; v_sev text;
begin
  select * into v_rule from public.alert_rules where code = 'COMM_LOST' and enabled;
  if v_rule.id is null then return; end if;
  for r in select id, last_seen_at from public.stations where last_seen_at is not null loop
    v_min := extract(epoch from now() - r.last_seen_at) / 60;
    v_sev := case when v_min > v_rule.critical_threshold then 'critical' when v_min > v_rule.warning_threshold then 'warning' end;
    if v_sev is not null then
      insert into public.alerts (station_id, code, severity, params)
      values (r.id, 'COMM_LOST', v_sev, jsonb_build_object('minutes', round(v_min)))
      on conflict do nothing;
    else
      update public.alerts set status = 'resolved' where station_id = r.id and code = 'COMM_LOST' and status <> 'resolved';
    end if;
  end loop;
end $$;

-- =========================================================================
-- Row level security
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.stations enable row level security;
alter table public.modules enable row level security;
alter table public.module_assignments enable row level security;
alter table public.telemetry enable row level security;
alter table public.station_latest enable row level security;
alter table public.station_daily enable row level security;
alter table public.module_daily enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.work_orders enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.service_history enable row level security;
alter table public.documents enable row level security;
alter table public.event_log enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles
create policy "profiles: read self, staff read all, owners read their technicians" on public.profiles for select using (
  id = auth.uid() or public.is_staff()
  or exists (select 1 from public.stations s where s.technician_id = profiles.id and public.can_see_station(s.id))
);
create policy "profiles: update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin update" on public.profiles for update using (public.is_admin());

-- customers
create policy "customers: visible" on public.customers for select using (
  public.is_admin() or owner_id = auth.uid()
  or exists (select 1 from public.stations s where s.customer_id = customers.id and public.can_see_station(s.id))
);
create policy "customers: admin write" on public.customers for all using (public.is_admin()) with check (public.is_admin());

-- stations
create policy "stations: visible" on public.stations for select using (public.can_see_station(id));
create policy "stations: update visible" on public.stations for update using (public.can_see_station(id)) with check (public.can_see_station(id));
create policy "stations: admin insert" on public.stations for insert with check (public.is_admin());
create policy "stations: admin delete" on public.stations for delete using (public.is_admin());

-- modules: staff see the whole registry (incl. spares); owners only modules that are/were in their stations
create policy "modules: visible" on public.modules for select using (
  public.is_staff()
  or (station_id is not null and public.can_see_station(station_id))
  or exists (select 1 from public.module_assignments a where a.module_id = modules.id and public.can_see_station(a.station_id))
);
create policy "modules: staff write" on public.modules for all using (public.is_staff()) with check (public.is_staff());

create policy "assignments: visible" on public.module_assignments for select using (public.can_see_station(station_id));
create policy "assignments: staff write" on public.module_assignments for all using (public.is_staff() and public.can_see_station(station_id)) with check (public.is_staff() and public.can_see_station(station_id));

-- telemetry & roll-ups: read-only for users, written by the ingest Edge Function (service role)
create policy "telemetry: visible" on public.telemetry for select using (public.can_see_station(station_id));
create policy "latest: visible" on public.station_latest for select using (public.can_see_station(station_id));
create policy "station_daily: visible" on public.station_daily for select using (public.can_see_station(station_id));
create policy "module_daily: visible" on public.module_daily for select using (public.can_see_station(station_id));

-- alerts
create policy "rules: staff read" on public.alert_rules for select using (public.is_staff());
create policy "rules: admin write" on public.alert_rules for all using (public.is_admin()) with check (public.is_admin());
create policy "alerts: visible" on public.alerts for select using (public.can_see_station(station_id));
create policy "alerts: update visible" on public.alerts for update using (public.can_see_station(station_id));

-- work orders
create policy "wo: visible" on public.work_orders for select using (public.can_see_station(station_id));
create policy "wo: create for visible station" on public.work_orders for insert with check (public.can_see_station(station_id));
create policy "wo: staff update" on public.work_orders for update using (public.is_staff() and public.can_see_station(station_id));
create policy "wo: admin delete" on public.work_orders for delete using (public.is_admin());

create policy "templates: read" on public.checklist_templates for select using (auth.uid() is not null);
create policy "checklist: visible" on public.checklist_items for select using (
  exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_see_station(w.station_id)));
create policy "checklist: staff write" on public.checklist_items for all using (
  public.is_staff() and exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_see_station(w.station_id)))
  with check (public.is_staff());

create policy "history: visible" on public.service_history for select using (public.can_see_station(station_id));
create policy "history: staff write" on public.service_history for insert with check (public.is_staff() and public.can_see_station(station_id));
create policy "documents: visible" on public.documents for select using (public.can_see_station(station_id));
create policy "documents: staff write" on public.documents for all using (public.is_staff() and public.can_see_station(station_id)) with check (public.is_staff() and public.can_see_station(station_id));
create policy "events: staff read" on public.event_log for select using (public.is_staff() and public.can_see_station(station_id));
create policy "push: own" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================================
-- Storage: private buckets, objects stored under "<station_id>/..."
-- =========================================================================
insert into storage.buckets (id, name, public) values
  ('photos', 'photos', false), ('signatures', 'signatures', false), ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "storage: read station files" on storage.objects for select using (
  bucket_id in ('photos', 'signatures', 'documents')
  and public.can_see_station(((storage.foldername(name))[1])::uuid)
);
create policy "storage: upload photos" on storage.objects for insert with check (
  bucket_id = 'photos' and public.can_see_station(((storage.foldername(name))[1])::uuid)
);
create policy "storage: staff upload signatures & documents" on storage.objects for insert with check (
  bucket_id in ('signatures', 'documents') and public.is_staff() and public.can_see_station(((storage.foldername(name))[1])::uuid)
);

-- =========================================================================
-- Realtime
-- =========================================================================
alter publication supabase_realtime add table public.station_latest, public.alerts, public.work_orders;

-- =========================================================================
-- Reference data
-- =========================================================================
insert into public.alert_rules (code, kind, metric, operator, warning_threshold, critical_threshold, event_severity, unit) values
  ('MODULE_OVER_TEMP', 'threshold', 'module_temp_c', '>', 45, 55, null, '°C'),
  ('CELL_IMBALANCE', 'threshold', 'cell_spread_mv', '>', 50, 100, null, 'mV'),
  ('SOH_LOW', 'threshold', 'module_soh_pct', '<', 85, 80, null, '%'),
  ('COOLANT_HIGH', 'threshold', 'coolant_out_c', '>', 35, 42, null, '°C'),
  ('COMM_LOST', 'threshold', 'minutes_since_last_seen', '>', 10, 60, null, 'min'),
  ('COOLING_PUMP_FAULT', 'event', null, null, null, null, 'critical', null),
  ('FIRE_SYSTEM_FAULT', 'event', null, null, null, null, 'critical', null),
  ('FIRE_TRIGGERED', 'event', null, null, null, null, 'critical', null),
  ('INVERTER_ERROR', 'event', null, null, null, null, 'warning', null),
  ('GRID_OUTAGE', 'event', null, null, null, null, 'info', null)
on conflict (code) do nothing;
