-- Hosting ladder (Aria, Oct 3 2026, 12:56): a Checkout Session for a step that stopped being sold
-- (ladder.ts sellable=false) can still complete if it was opened before the flag turned off and
-- before it was expired. We HONOR it (the subscription is kept) and flag it for admin review: one row
-- here per such session, written by the Stripe webhook (checkout.session.completed, service role),
-- shown as a badge on Admin > Customers until someone marks it reviewed.
-- Depends on 20261003180000 (plan steps). Step ids live in src/lib/plans/ladder.ts (PLAN_STEP_IDS);
-- the CHECK below must match it (src/lib/plans/plan-unsold-migration.test.ts).
--
-- Customers have NO access (no grants, RLS forced, no customer policy). service_role may SELECT,
-- INSERT and UPDATE (reviewed_at); nobody deletes through the API.
-- Idempotent: IF NOT EXISTS / drop-then-add constraint / guarded policy; re-running changes nothing.
-- No functions are created (the coming no-default-EXECUTE rule does not apply); column defaults
-- use built-in gen_random_uuid() and now().

create table if not exists public.plan_unsold_purchases (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id text not null,
  user_id uuid null references auth.users (id) on delete set null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  plan_step text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  constraint plan_unsold_purchases_session_key unique (checkout_session_id),
  constraint plan_unsold_purchases_session_format check (checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$')
);

alter table public.plan_unsold_purchases drop constraint if exists plan_unsold_purchases_plan_step_check;
alter table public.plan_unsold_purchases add constraint plan_unsold_purchases_plan_step_check
  check (plan_step in ('starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth'));

create index if not exists plan_unsold_purchases_open_idx
  on public.plan_unsold_purchases (created_at desc) where reviewed_at is null;

comment on table public.plan_unsold_purchases is
  'Checkout completed for a step that was no longer sellable (ladder.ts). Honored (subscription kept); one row per Checkout Session, written by the Stripe webhook; admin badge until reviewed_at is set.';

alter table public.plan_unsold_purchases enable row level security;
alter table public.plan_unsold_purchases force row level security;

revoke all on table public.plan_unsold_purchases from public, anon, authenticated, service_role;
grant select, insert, update on table public.plan_unsold_purchases to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plan_unsold_purchases' and policyname = 'plan_unsold_purchases_service_role_all'
  ) then
    create policy plan_unsold_purchases_service_role_all on public.plan_unsold_purchases
      for all to service_role using (true) with check (true);
  end if;
end
$$;
