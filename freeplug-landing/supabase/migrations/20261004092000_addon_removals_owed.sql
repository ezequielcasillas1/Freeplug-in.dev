-- Add-ons (Oct 4 2026), L-1 (Aria 9:57 AM CT): a customer is never charged for an add-on they turned off.
-- Part of the add-ons migration set (20261004090000_plan_addons, 20261004091000_addon_edit_uses, this one).
--
-- addon_removals_owed: an add-on removal the customer asked for that Stripe does not hold (an upgrade
-- released the schedule and putting the removal back failed 3 times, or a Resume could not put it back).
-- The invoice.paid self-heal (src/lib/stripe/addon-removal-owed.ts) removes the item at the renewal,
-- refunds what that renewal billed for it once, then clears the row (cleared_at + how + invoice).
-- Internal only: written and read by the service role; customers never read it (no customer policy).
-- At most ONE open row per subscription (a second save merges the add-ons).
--
-- Idempotent: IF NOT EXISTS / drop-then-add constraints / guarded policies.
-- LOCAL ONLY: not applied anywhere hosted (the add-ons set stays pending for hosted).

create table if not exists public.addon_removals_owed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete set null,
  stripe_customer_id text null,
  stripe_subscription_id text not null,
  -- add-on ids (src/lib/plans/ladder.ts ADDONS)
  addons text[] not null,
  -- when it should have ended (the period end the removal was scheduled for)
  effective_at timestamptz not null,
  -- what put it here: 'upgrade' (L-1) or 'resume' (Vera M-1)
  source text not null default 'upgrade',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cleared_at timestamptz null,
  cleared_how text null,
  cleared_invoice_id text null
);

alter table public.addon_removals_owed drop constraint if exists addon_removals_owed_addons_check;
alter table public.addon_removals_owed
  add constraint addon_removals_owed_addons_check
  check (cardinality(addons) between 1 and 2 and addons <@ array['small_edit', 'big_change']::text[]);
alter table public.addon_removals_owed drop constraint if exists addon_removals_owed_source_check;
alter table public.addon_removals_owed
  add constraint addon_removals_owed_source_check check (source in ('upgrade', 'resume'));
alter table public.addon_removals_owed drop constraint if exists addon_removals_owed_cleared_check;
alter table public.addon_removals_owed
  add constraint addon_removals_owed_cleared_check check (
    (cleared_at is null and cleared_how is null)
    or (cleared_at is not null and cleared_how in ('refunded', 'not_billed', 'kept'))
  );

create unique index if not exists addon_removals_owed_one_open
  on public.addon_removals_owed (stripe_subscription_id) where cleared_at is null;

comment on table public.addon_removals_owed is
  'L-1 (Oct 4): add-on removals the customer asked for that Stripe does not hold. The invoice.paid self-heal removes the item, refunds the renewal line once, and clears the row. Service role only.';

alter table public.addon_removals_owed enable row level security;
alter table public.addon_removals_owed force row level security;

revoke all on table public.addon_removals_owed from public, anon, authenticated, service_role;
grant select, insert, update on table public.addon_removals_owed to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'addon_removals_owed' and policyname = 'addon_removals_owed_service_role_all'
  ) then
    create policy addon_removals_owed_service_role_all on public.addon_removals_owed
      for all to service_role using (true) with check (true);
  end if;
end
$$;
