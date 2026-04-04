-- ============================================================
-- PropManager — Supabase Schema
-- Run AFTER cleanup.sql
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

-- Companies
create table if not exists public.companies (
  id              uuid        default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  name            text        not null,
  name_ar         text,
  rega_license    text,
  logo_url        text,
  plan            text        not null default 'starter'
                              check (plan in ('starter', 'growth', 'enterprise')),
  plan_expires_at timestamptz,
  -- Default reservation expiry in days (used when creating reservations)
  default_reservation_days int not null default 14
);

-- User profiles (extends auth.users with role + company)
-- NOTE: The first owner record is created via service role during company onboarding
create table if not exists public.user_profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  company_id  uuid references public.companies(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  full_name   text        not null,
  role        text        not null
              check (role in ('owner', 'cfo', 'sales_manager', 'reservation_manager', 'accountant')),
  phone       text,
  -- Telegram bot auth
  telegram_chat_id  bigint,
  telegram_verified boolean not null default false
);

-- ============================================================
-- HELPER FUNCTIONS
-- security definer = runs as postgres (bypasses RLS on user_profiles)
-- This avoids infinite recursion when RLS policies call these functions
-- ============================================================

create or replace function auth_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from public.user_profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text
language sql
security definer
stable
as $$
  select role from public.user_profiles where id = auth.uid()
$$;

create or replace function auth_has_role(roles text[])
returns boolean
language sql
security definer
stable
as $$
  select (select role from public.user_profiles where id = auth.uid()) = any(roles)
$$;

-- Projects
create table if not exists public.projects (
  id             uuid default gen_random_uuid() primary key,
  company_id     uuid references public.companies(id) on delete cascade not null,
  created_at     timestamptz default now() not null,
  name           text not null,
  name_ar        text,
  project_number text not null,
  city           text,
  location_notes text
);

-- Buildings
create table if not exists public.buildings (
  id              uuid default gen_random_uuid() primary key,
  project_id      uuid references public.projects(id) on delete cascade not null,
  company_id      uuid references public.companies(id) on delete cascade not null,
  created_at      timestamptz default now() not null,
  name            text,
  building_number text not null,
  total_floors    int
);

-- Floor plans (one per building + floor — shared by all units on that floor)
create table if not exists public.floor_plans (
  id           uuid default gen_random_uuid() primary key,
  building_id  uuid references public.buildings(id) on delete cascade not null,
  company_id   uuid references public.companies(id) on delete cascade not null,
  created_at   timestamptz default now() not null,
  floor_number int  not null,
  file_url     text not null,
  file_name    text,
  unique (building_id, floor_number)
);

-- Units
create table if not exists public.units (
  id                   uuid default gen_random_uuid() primary key,
  building_id          uuid references public.buildings(id) on delete cascade not null,
  project_id           uuid references public.projects(id) on delete cascade not null,
  company_id           uuid references public.companies(id) on delete cascade not null,
  created_at           timestamptz default now() not null,
  -- Identity
  sak_id               text unique not null,  -- صك — globally unique deed number
  unit_number          text not null,
  floor                int  not null,
  -- Physical
  area_sqm             numeric(10,2) not null,
  -- Utility IDs
  electricity_meter_id text,
  water_meter_id       text,
  -- Pricing
  price                numeric(14,2) not null,
  -- Status
  status               text not null default 'available'
                       check (status in ('available', 'reserved', 'sold'))
);

create index if not exists units_company_status_idx on public.units (company_id, status);
create index if not exists units_building_idx       on public.units (building_id);
create index if not exists units_sak_idx            on public.units (sak_id);

-- Customers
create table if not exists public.customers (
  id           uuid default gen_random_uuid() primary key,
  company_id   uuid references public.companies(id) on delete cascade not null,
  created_at   timestamptz default now() not null,
  -- Identity (required for PDF contracts)
  full_name    text not null,
  id_type      text not null check (id_type in ('national_id', 'iqama', 'passport')),
  id_number    text not null,
  birthdate    date,
  -- Contact
  phone        text not null,
  email        text,
  -- CRM
  lead_source  text not null
               check (lead_source in ('instagram', 'snapchat', 'tiktok', 'realtor_referral', 'walk_in', 'direct', 'other')),
  notes        text,
  unique (company_id, id_number)
);

-- External realtors (referral sources — not system users)
create table if not exists public.external_realtors (
  id            uuid default gen_random_uuid() primary key,
  company_id    uuid references public.companies(id) on delete cascade not null,
  created_at    timestamptz default now() not null,
  name          text not null,
  phone         text,
  office_name   text,  -- مكتب عقاري
  rega_license  text   -- optional
);

-- Reservations
create table if not exists public.reservations (
  id                       uuid default gen_random_uuid() primary key,
  company_id               uuid references public.companies(id) on delete cascade not null,
  unit_id                  uuid references public.units(id) not null,
  customer_id              uuid references public.customers(id) not null,
  created_by               uuid references auth.users(id),
  created_at               timestamptz default now() not null,
  -- Payment
  deposit_amount           numeric(14,2) not null,
  payment_method           text not null check (payment_method in ('cash', 'bank_transfer', 'check')),
  payment_reference        text,
  payment_date             date not null,
  received_by              uuid references auth.users(id),
  receipt_file_url         text,
  -- Status & expiry
  status                   text not null default 'active'
                           check (status in ('active', 'converted', 'cancelled')),
  expires_at               date not null,
  -- Deposit return
  deposit_returned         boolean not null default false,
  deposit_return_date      date,
  deposit_return_method    text check (deposit_return_method in ('cash', 'bank_transfer', 'check')),
  deposit_return_reference text,
  deposit_returned_by      uuid references auth.users(id),
  refund_amount            numeric(14,2),  -- for partial refunds on cancellation
  -- Cancellation
  cancellation_reason      text
);

create index if not exists reservations_unit_idx    on public.reservations (unit_id, status);
create index if not exists reservations_company_idx on public.reservations (company_id, status, expires_at);
create index if not exists reservations_customer_idx on public.reservations (customer_id);

-- Sales
create table if not exists public.sales (
  id                       uuid default gen_random_uuid() primary key,
  company_id               uuid references public.companies(id) on delete cascade not null,
  unit_id                  uuid references public.units(id) not null,
  customer_id              uuid references public.customers(id) not null,
  reservation_id           uuid references public.reservations(id), -- nullable: null = direct sale
  created_by               uuid references auth.users(id),
  created_at               timestamptz default now() not null,
  -- Payment
  payment_amount           numeric(14,2) not null,
  payment_method           text not null check (payment_method in ('cash', 'bank_transfer', 'check')),
  payment_reference        text,
  payment_date             date not null,
  received_by              uuid references auth.users(id),
  receipt_file_url         text,
  -- Commission
  total_commission_amount  numeric(14,2),   -- SAR — set manually, participants % apply to this
  commission_finalized     boolean not null default false,  -- toggled by Owner only
  commission_finalized_by  uuid references auth.users(id),
  commission_finalized_at  timestamptz,
  -- Status
  status                   text not null default 'completed'
                           check (status in ('completed', 'reversed')),
  reversal_reason          text  -- required when status = 'reversed'
);

create index if not exists sales_company_idx on public.sales (company_id, status);
create index if not exists sales_unit_idx    on public.sales (unit_id);
create index if not exists sales_customer_idx on public.sales (customer_id);

-- Sale participants
create table if not exists public.sale_participants (
  id                   uuid default gen_random_uuid() primary key,
  sale_id              uuid references public.sales(id) on delete cascade not null,
  company_id           uuid references public.companies(id) on delete cascade not null,
  -- One of these must be set (not both)
  user_id              uuid references auth.users(id),
  external_realtor_id  uuid references public.external_realtors(id),
  -- Commission
  commission_percentage numeric(5,2) not null
                        check (commission_percentage > 0 and commission_percentage <= 100),
  notes                text,
  constraint one_participant_type check (
    (user_id is not null and external_realtor_id is null) or
    (user_id is null and external_realtor_id is not null)
  )
);

create index if not exists sale_participants_sale_idx on public.sale_participants (sale_id);

-- Audit log
create table if not exists public.audit_log (
  id          uuid default gen_random_uuid() primary key,
  company_id  uuid references public.companies(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  user_id     uuid references auth.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid not null,
  old_value   jsonb,
  new_value   jsonb
);

create index if not exists audit_log_company_idx on public.audit_log (company_id, created_at desc);
create index if not exists audit_log_entity_idx  on public.audit_log (entity_type, entity_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.companies         enable row level security;
alter table public.user_profiles     enable row level security;
alter table public.projects          enable row level security;
alter table public.buildings         enable row level security;
alter table public.floor_plans       enable row level security;
alter table public.units             enable row level security;
alter table public.customers         enable row level security;
alter table public.external_realtors enable row level security;
alter table public.reservations      enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_participants enable row level security;
alter table public.audit_log         enable row level security;


-- companies: read own company only
create policy "companies_select" on public.companies for select
  using (id = auth_company_id());

-- user_profiles: read all profiles in own company
create policy "user_profiles_select" on public.user_profiles for select
  using (company_id = auth_company_id());

-- user_profiles: owner manages all staff; any user updates their own profile
create policy "user_profiles_insert" on public.user_profiles for insert
  with check (auth_has_role(array['owner']));

create policy "user_profiles_update" on public.user_profiles for update
  using (id = auth.uid() or auth_has_role(array['owner']));

create policy "user_profiles_delete" on public.user_profiles for delete
  using (auth_has_role(array['owner']));

-- projects: all roles read; owner + sales_manager write
create policy "projects_select" on public.projects for select
  using (company_id = auth_company_id());

create policy "projects_insert" on public.projects for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "projects_update" on public.projects for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "projects_delete" on public.projects for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- buildings: same as projects
create policy "buildings_select" on public.buildings for select
  using (company_id = auth_company_id());

create policy "buildings_insert" on public.buildings for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "buildings_update" on public.buildings for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "buildings_delete" on public.buildings for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- floor_plans: all roles read; owner + sales_manager write
create policy "floor_plans_select" on public.floor_plans for select
  using (company_id = auth_company_id());

create policy "floor_plans_insert" on public.floor_plans for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "floor_plans_update" on public.floor_plans for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "floor_plans_delete" on public.floor_plans for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

-- units: all roles read; owner + sales_manager + reservation_manager update status
create policy "units_select" on public.units for select
  using (company_id = auth_company_id());

create policy "units_insert" on public.units for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "units_update" on public.units for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager', 'reservation_manager']));

create policy "units_delete" on public.units for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- customers: all roles read; sales_manager + reservation_manager write; owner delete
create policy "customers_select" on public.customers for select
  using (company_id = auth_company_id());

create policy "customers_insert" on public.customers for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager', 'reservation_manager']));

create policy "customers_update" on public.customers for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager', 'reservation_manager']));

create policy "customers_delete" on public.customers for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- external_realtors: all roles read; owner + sales_manager write
create policy "external_realtors_select" on public.external_realtors for select
  using (company_id = auth_company_id());

create policy "external_realtors_insert" on public.external_realtors for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "external_realtors_update" on public.external_realtors for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "external_realtors_delete" on public.external_realtors for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- reservations: all roles read; sales_manager + reservation_manager write; owner delete
create policy "reservations_select" on public.reservations for select
  using (company_id = auth_company_id());

create policy "reservations_insert" on public.reservations for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager', 'reservation_manager']));

create policy "reservations_update" on public.reservations for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager', 'reservation_manager']));

create policy "reservations_delete" on public.reservations for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- sales: reservation_manager cannot see sales at all (no payment amounts)
create policy "sales_select" on public.sales for select
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'cfo', 'sales_manager', 'accountant']));

create policy "sales_insert" on public.sales for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "sales_update" on public.sales for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "sales_delete" on public.sales for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- sale_participants: owner + cfo + sales_manager read/write
create policy "sale_participants_select" on public.sale_participants for select
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'cfo', 'sales_manager']));

create policy "sale_participants_insert" on public.sale_participants for insert
  with check (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "sale_participants_update" on public.sale_participants for update
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'sales_manager']));

create policy "sale_participants_delete" on public.sale_participants for delete
  using (company_id = auth_company_id() and auth_has_role(array['owner']));

-- audit_log: owner + cfo read only; inserts via service role from backend
create policy "audit_log_select" on public.audit_log for select
  using (company_id = auth_company_id() and auth_has_role(array['owner', 'cfo']));
