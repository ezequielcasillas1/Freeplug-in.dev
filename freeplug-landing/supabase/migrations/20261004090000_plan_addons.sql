-- Add-ons (Oct 4 2026): the plan snapshot carries the customer's add-ons.
-- Depends on 20261003180000_plan_steps.sql (profiles snapshot + guard trigger) and
-- 20261003200000_tipping.sql (plan_tip_cents, last version of the guard trigger).
--
-- Stripe holds the truth (one subscription = the step price + one item per add-on, quantity 1, +
-- the tip). profiles.plan_addons is the snapshot of the add-on ids on the live subscription, written
-- by the Stripe webhook with the rest of the plan snapshot (src/lib/plans/plan-step-sync.ts). It
-- grants the add-on perks (+1 small edit, Big change) in the app. Customers can't set it: the guard
-- trigger covers it.
--
-- Idempotent: IF NOT EXISTS / drop-then-add constraints / CREATE OR REPLACE; re-running changes nothing.
-- LOCAL ONLY: not applied anywhere hosted.

alter table public.profiles
  add column if not exists plan_addons text[] not null default '{}';
alter table public.profiles
  drop constraint if exists profiles_plan_addons_check;
-- The known add-on ids (src/lib/plans/ladder.ts ADDON_IDS), each at most once, at most 2.
alter table public.profiles
  add constraint profiles_plan_addons_check
  check (
    plan_addons <@ array['small_edit', 'big_change']::text[]
    and cardinality(plan_addons) <= 2
    and not (cardinality(plan_addons) = 2 and plan_addons[1] = plan_addons[2])
  );
comment on column public.profiles.plan_addons is
  'Add-ons (Oct 4): add-on ids on the live hosting subscription (small_edit, big_change), written by the Stripe webhook with the plan snapshot. Grants the add-on perks. Customers cannot set it (trigger profiles_guard_plan_step).';

-- Guard trigger (20261003180000, 20261003200000) now covers plan_addons too. Same body otherwise.
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
  if tg_op = 'INSERT'
     and new.plan_step is null and new.plan_step_synced_at is null
     and new.plan_legacy is not true and new.plan_legacy_addon is null and new.plan_monthly_cents is null
     and new.plan_tip_cents is null and coalesce(cardinality(new.plan_addons), 0) = 0 then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.plan_step is not distinct from old.plan_step
     and new.plan_step_synced_at is not distinct from old.plan_step_synced_at
     and new.plan_legacy is not distinct from old.plan_legacy
     and new.plan_legacy_addon is not distinct from old.plan_legacy_addon
     and new.plan_monthly_cents is not distinct from old.plan_monthly_cents
     and new.plan_tip_cents is not distinct from old.plan_tip_cents
     and new.plan_addons is not distinct from old.plan_addons then
    return new;
  end if;

  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;

  raise exception using
    message = 'plan_step and the plan snapshot can only be set by the server (service role).',
    errcode = '42501';
end;
$$;

revoke all on function public.profiles_guard_plan_step() from public, anon, authenticated, service_role;
-- (no grant: trigger function, called by no role)
