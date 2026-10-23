-- Billing activity rows that are not payments (Cheke, Oct 23 2026): first use = the $50 of a
-- $100 -> $35 downgrade, shown in the client's Recent activity with the client's choice
-- (credit_choice: 'buyout' = counts toward the buyout, 'refund' = refunded to the original payment method). One row per refund (activity_key unique),
-- so a retried downgrade or a replay never adds a second row. Written by the server (service role) only;
-- a client reads only their own rows. Additive: no existing table or row is changed.
create table if not exists public.billing_activity (
  id uuid primary key default gen_random_uuid(),
  activity_key text not null unique check (length(activity_key) between 1 and 300),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('refund')),
  reason text not null default 'other' check (reason in ('downgrade', 'other')),
  amount_cents integer not null check (amount_cents > 0),
  credit_choice text null check (credit_choice in ('buyout', 'refund')),
  stripe_refund_id text null,
  stripe_invoice_id text null,
  created_at timestamptz not null default now()
);
create index if not exists billing_activity_profile_idx on public.billing_activity (profile_id, created_at desc);
alter table public.billing_activity enable row level security;
revoke all on table public.billing_activity from public, anon, authenticated;
grant select on table public.billing_activity to authenticated;
grant select, insert, update, delete on table public.billing_activity to service_role;
drop policy if exists "billing_activity_select_own" on public.billing_activity;
create policy "billing_activity_select_own" on public.billing_activity
  for select to authenticated using (profile_id = (select auth.uid()));
