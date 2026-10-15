-- The tipping system (Oct 3 2026): an optional monthly tip on top of a hosting ladder step.
-- Depends on 20261003180000_plan_steps.sql (profiles snapshot + guard trigger, outreach_sites.plan_step).
--
-- Stripe holds the truth (one subscription = the step price + a $1/month tip price with
-- quantity = tip dollars). These columns only carry the tip separately so it never blurs into the
-- plan price or perks:
--   1. outreach_sites.plan_tip_dollars  tip chosen with the plan at claim step 3, charged from
--                                        publish. Service role only (the table has no customer grants).
--   2. billing_ledger.tip_cents          the tip part of each paid invoice. amount_cents stays the
--                                        full amount paid, so every existing total is unchanged.
--   3. profiles.plan_tip_cents           the live tip, written by the Stripe webhook with the rest of
--                                        the plan snapshot. Display only: perks and queue order come
--                                        from plan_step. Added to the snapshot guard trigger, so
--                                        customers can't set it.
--
-- Idempotent: IF NOT EXISTS / drop-then-add constraints / CREATE OR REPLACE; re-running changes nothing.
-- LOCAL ONLY for now: part of the r13 hosted set (applied hosted only after Vera's retest and Ezequiel's go).

-- 1) outreach_sites.plan_tip_dollars ------------------------------------------------------------
alter table public.outreach_sites
  add column if not exists plan_tip_dollars integer;
alter table public.outreach_sites
  drop constraint if exists outreach_sites_plan_tip_dollars_check;
-- Generous outer bound; the per-step range lives in src/lib/plans/ladder.ts (TIP_TOTAL_RANGES) and is
-- checked by the server on save and again at publish.
alter table public.outreach_sites
  add constraint outreach_sites_plan_tip_dollars_check
  check (plan_tip_dollars is null or plan_tip_dollars between 0 and 500);
comment on column public.outreach_sites.plan_tip_dollars is
  'Tipping system: monthly tip in whole dollars chosen with plan_step at claim step 3 (null/0 = none). Charged from publish as the tip price x quantity.';

-- 2) billing_ledger.tip_cents -------------------------------------------------------------------
alter table public.billing_ledger
  add column if not exists tip_cents integer not null default 0;
alter table public.billing_ledger
  drop constraint if exists billing_ledger_tip_cents_check;
alter table public.billing_ledger
  add constraint billing_ledger_tip_cents_check
  check (tip_cents >= 0 and tip_cents <= greatest(amount_cents, 0));
comment on column public.billing_ledger.tip_cents is
  'Tipping system: the tip part of amount_cents for this invoice (0 = none). amount_cents stays the full amount paid.';

-- 3) profiles.plan_tip_cents --------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan_tip_cents integer;
alter table public.profiles
  drop constraint if exists profiles_plan_tip_cents_check;
alter table public.profiles
  add constraint profiles_plan_tip_cents_check
  check (plan_tip_cents is null or plan_tip_cents >= 0);
comment on column public.profiles.plan_tip_cents is
  'Tipping system: the live monthly tip in cents, written by the Stripe webhook with the plan snapshot. Display only; never a perk.';

-- Guard trigger (20261003180000) now covers plan_tip_cents too. Same body otherwise.
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
     and new.plan_tip_cents is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.plan_step is not distinct from old.plan_step
     and new.plan_step_synced_at is not distinct from old.plan_step_synced_at
     and new.plan_legacy is not distinct from old.plan_legacy
     and new.plan_legacy_addon is not distinct from old.plan_legacy_addon
     and new.plan_monthly_cents is not distinct from old.plan_monthly_cents
     and new.plan_tip_cents is not distinct from old.plan_tip_cents then
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
