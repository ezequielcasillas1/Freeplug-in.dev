-- Plug Authority (Nov 2026): seventh hosting ladder step. Ids must match src/lib/plans/ladder.ts PLAN_STEP_IDS.
-- Idempotent: drop-then-add CHECK only. No Stripe or product setup in this migration.

alter table public.outreach_sites drop constraint if exists outreach_sites_plan_step_check;
alter table public.outreach_sites add constraint outreach_sites_plan_step_check
  check (plan_step is null or plan_step in ('starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth', 'plug_authority'));

alter table public.profiles drop constraint if exists profiles_plan_step_check;
alter table public.profiles add constraint profiles_plan_step_check
  check (plan_step is null or plan_step in ('starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth', 'plug_authority'));

alter table public.plan_unsold_purchases drop constraint if exists plan_unsold_purchases_plan_step_check;
alter table public.plan_unsold_purchases add constraint plan_unsold_purchases_plan_step_check
  check (plan_step in ('starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth', 'plug_authority'));
