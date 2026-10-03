-- Hosting ladder (Aria's card, Oct 3 2026): plan steps + the included small edit.
-- Depends on 20260402120000 (profiles, website_requests), 20260927050100 (outreach_sites).
--
-- Step ids live in ONE app config module (src/lib/plans/ladder.ts, PLAN_STEP_IDS). The CHECK lists
-- below must match it; src/lib/plans/plan-steps-migration.test.ts fails if they drift.
--
--   1. outreach_sites.plan_step     claim step 3 choice (service role only; the table already has
--                                   no customer grants and a service-role-only guard trigger).
--   2. profiles.plan_step (+ plan_step_synced_at)
--                                   cache of the customer's current step, written by the Stripe
--                                   webhook with the service role (admin queue order + badge).
--                                   Stripe stays the source of truth. Guard trigger: only the
--                                   server may set it.
--   3. website_requests.due_by      "done by end of next business day" (Fast lane and up), set by
--                                   an admin action. Customers have an UPDATE policy on their open
--                                   requests, so a guard trigger stops them setting it.
--   4. included_edit_uses           one row per used included small edit. UNIQUE (user_id,
--                                   period_start) = at most one per billing period, enforced by the
--                                   database. Customers can read their own rows (dashboard line);
--                                   only the service role writes.
--
-- Grandfathered Basic/Plus/Pro subscribers are NOT migrated: nothing here touches existing plans,
-- and the old outreach_sites.plan_hosting_cents / plan_addon_tier columns are kept as they are.
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / drop-then-add constraints / guarded policies;
-- re-running changes nothing.
--
-- Version 20261003180000: 20261003170000 is reserved for a future account-erase migration.
--
-- Function privileges (rule coming: postgres-created functions get NO default EXECUTE, not even
-- PUBLIC): every function here is revoked from PUBLIC, anon, authenticated and service_role
-- first, then granted to exactly the roles that call it. The two functions below are trigger
-- functions: no role calls them (Postgres checks EXECUTE only when the trigger is created, by the
-- owner running this migration, not when it fires), so they are granted to nobody.
-- Column defaults: gen_random_uuid() and now() are built-in pg_catalog functions (PUBLIC execute),
-- so service_role inserts that rely on them keep working; the throwaway check proves it with
-- default function privileges revoked.

-- 1) outreach_sites.plan_step -------------------------------------------------------------------
alter table public.outreach_sites
  add column if not exists plan_step text;

alter table public.outreach_sites
  drop constraint if exists outreach_sites_plan_step_check;
alter table public.outreach_sites
  add constraint outreach_sites_plan_step_check
  check (plan_step is null or plan_step in ('starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth'));

comment on column public.outreach_sites.plan_step is
  'Hosting ladder step chosen at claim step 3 (src/lib/plans/ladder.ts). Null = not chosen yet, or only a pre-ladder slider/add-on choice (plan_hosting_cents / plan_addon_tier, kept read-only).';

-- 2) profiles.plan_step -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan_step text;
alter table public.profiles
  add column if not exists plan_step_synced_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_plan_step_check;
alter table public.profiles
  add constraint profiles_plan_step_check
  check (plan_step is null or plan_step in ('starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth'));

comment on column public.profiles.plan_step is
  'Cache of the customer''s current hosting ladder step (or the step a grandfathered plan''s monthly total reaches), written by the Stripe webhook (service role). Stripe is the source of truth. Customers cannot set it (trigger profiles_guard_plan_step).';
comment on column public.profiles.plan_step_synced_at is
  'When the Stripe webhook last recomputed profiles.plan_step.';

-- Same rule as website_requests_guard_is_buyout: service_role, or the owner roles outside a
-- customer API request. Anyone else (authenticated / anon, including through a SECURITY DEFINER
-- function a customer calls) gets 42501 when they set or change these columns.
create or replace function public.profiles_guard_plan_step()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
begin
  if tg_op = 'INSERT' and new.plan_step is null and new.plan_step_synced_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.plan_step is not distinct from old.plan_step
     and new.plan_step_synced_at is not distinct from old.plan_step_synced_at then
    return new;
  end if;

  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;

  raise exception using
    message = 'plan_step can only be set by the server (service role).',
    errcode = '42501';
end;
$$;

revoke all on function public.profiles_guard_plan_step() from public, anon, authenticated, service_role;
-- (no grant: trigger function, called by no role)

drop trigger if exists profiles_guard_plan_step on public.profiles;
create trigger profiles_guard_plan_step
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_plan_step();

-- 3) website_requests.due_by --------------------------------------------------------------------
alter table public.website_requests
  add column if not exists due_by timestamptz;

comment on column public.website_requests.due_by is
  'Small edit due time ("done by end of next business day", Fast lane and up). Admin-only: set by the service role; customers cannot set or change it (trigger website_requests_guard_due_by).';

create or replace function public.website_requests_guard_due_by()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
begin
  if tg_op = 'INSERT' and new.due_by is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.due_by is not distinct from old.due_by then
    return new;
  end if;

  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;

  raise exception using
    message = 'due_by can only be set by the server (service role).',
    errcode = '42501';
end;
$$;

revoke all on function public.website_requests_guard_due_by() from public, anon, authenticated, service_role;
-- (no grant: trigger function, called by no role)

drop trigger if exists website_requests_guard_due_by on public.website_requests;
create trigger website_requests_guard_due_by
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_due_by();

-- 4) included_edit_uses -------------------------------------------------------------------------
create table if not exists public.included_edit_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The subscription's current_period_start (UTC date) when the edit was used.
  period_start date not null,
  request_id uuid null references public.website_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint included_edit_uses_user_period_key unique (user_id, period_start),
  constraint included_edit_uses_request_id_key unique (request_id)
);

comment on table public.included_edit_uses is
  'Included small edit used (Fast lane and up, grandfathered Plus/Pro): one row per user per billing period. Written by the service role (admin action); customers read their own rows.';

alter table public.included_edit_uses enable row level security;
alter table public.included_edit_uses force row level security;

-- Privileges: nothing for PUBLIC / anon (undoes Supabase's default grants). authenticated may only
-- SELECT (and RLS limits that to their own rows). service_role: SELECT + INSERT. No UPDATE or
-- DELETE for anyone through the API: a used edit stays used (rows go only with the auth user).
revoke all on table public.included_edit_uses from public, anon, authenticated, service_role;
grant select on table public.included_edit_uses to authenticated;
grant select, insert on table public.included_edit_uses to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'included_edit_uses' and policyname = 'included_edit_uses_select_own'
  ) then
    create policy included_edit_uses_select_own on public.included_edit_uses
      for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'included_edit_uses' and policyname = 'included_edit_uses_service_role_all'
  ) then
    create policy included_edit_uses_service_role_all on public.included_edit_uses
      for all to service_role using (true) with check (true);
  end if;
end
$$;
