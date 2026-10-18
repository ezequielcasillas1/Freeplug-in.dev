-- Oct 18 2026 (Cheke): edits plan structure, admin maintenance quotes, every dollar toward buyout.
-- LOCAL / scratch only until Cheke says otherwise. No table is dropped; big_change_uses and plan_addons stay.

-- 1) Edits: plans now include up to 50 edits (+20 pack) or unlimited, so the 2-slot cap on included_edit_uses
--    becomes "slot >= 1". The server (included-edits.ts) only uses slots up to the plan's allowance.
alter table public.included_edit_uses drop constraint if exists included_edit_uses_slot_check;
alter table public.included_edit_uses add constraint included_edit_uses_slot_check check (slot >= 1);

-- 2) Maintenance quotes (admin Change requests page). One live (non-void) quote per change request.
create table if not exists public.maintenance_quotes (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.change_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 1000000),
  description text not null check (length(description) between 1 and 500),
  days_until_due integer not null default 7 check (days_until_due = 7),
  status text not null default 'draft' check (status in ('draft', 'unpaid', 'paid', 'void')),
  stripe_invoice_id text null unique,
  send_started_at timestamptz null,
  sent_at timestamptz null,
  paid_at timestamptz null,
  voided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists maintenance_quotes_one_live_per_request
  on public.maintenance_quotes (change_request_id) where status <> 'void';
alter table public.maintenance_quotes enable row level security;
revoke all on table public.maintenance_quotes from public, anon, authenticated;
grant select, insert, update, delete on table public.maintenance_quotes to service_role;

-- 3) Every dollar toward buyout: an ownership ledger keyed on the Stripe CHARGE (one payment row per charge,
--    so invoice.paid and charge.succeeded for the same money count once). Signed amounts: payments > 0,
--    refunds and disputes <= 0. Payments clear 14 days after they were paid. Amounts are before tax and are
--    NOT net of Stripe fees. The buyout price itself is unchanged (website_requests.buyout_price_cents).
create table if not exists public.ownership_ledger (
  entry_key text primary key check (length(entry_key) between 1 and 300),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  stripe_charge_id text not null,
  kind text not null check (kind in ('payment', 'refund', 'dispute')),
  source text not null default 'invoice' check (source in ('invoice', 'charge', 'stripe')),
  amount_cents integer not null,
  final boolean not null default false,
  occurred_at timestamptz not null,
  clears_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint ownership_ledger_sign check (
    (kind = 'payment' and amount_cents >= 0) or (kind <> 'payment' and amount_cents <= 0)
  )
);
create index if not exists ownership_ledger_profile_idx on public.ownership_ledger (profile_id);
create index if not exists ownership_ledger_charge_idx on public.ownership_ledger (stripe_charge_id);
alter table public.ownership_ledger enable row level security;
revoke all on table public.ownership_ledger from public, anon, authenticated;
grant select on table public.ownership_ledger to authenticated;
grant select, insert, update, delete on table public.ownership_ledger to service_role;
drop policy if exists "ownership_ledger_select_own" on public.ownership_ledger;
create policy "ownership_ledger_select_own" on public.ownership_ledger
  for select to authenticated using (profile_id = (select auth.uid()));

-- Idempotent upsert, same rules as src/lib/buyout/ownership.ts (memory store in tests):
--   payment: first write wins, except an invoice amount (before tax) replaces a raw charge amount.
--   refund : the refunded total per charge only grows (partial then full; replays change nothing).
--   dispute: latest non-final state wins; once final (won -> 0, lost -> negative) it never changes.
-- Returns 'inserted' | 'updated' | 'unchanged'. Service role only.
create or replace function public.record_ownership_entry(
  p_entry_key text,
  p_profile_id uuid,
  p_charge_id text,
  p_kind text,
  p_amount_cents integer,
  p_occurred_at timestamptz,
  p_source text default 'invoice',
  p_final boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_old public.ownership_ledger%rowtype;
begin
  select * into v_old from public.ownership_ledger where entry_key = p_entry_key for update;
  if not found then
    insert into public.ownership_ledger (entry_key, profile_id, stripe_charge_id, kind, source, amount_cents, final, occurred_at, clears_at)
    values (p_entry_key, p_profile_id, p_charge_id, p_kind, p_source, p_amount_cents, coalesce(p_final, false), p_occurred_at,
            case when p_kind = 'payment' then p_occurred_at + interval '14 days' else null end)
    on conflict (entry_key) do nothing;
    if found then return 'inserted'; end if;
    return 'unchanged';
  end if;
  if p_kind = 'payment' and v_old.source = 'charge' and p_source = 'invoice' and v_old.amount_cents <> p_amount_cents then
    update public.ownership_ledger set amount_cents = p_amount_cents, source = 'invoice', updated_at = pg_catalog.now() where entry_key = p_entry_key;
    return 'updated';
  elsif p_kind = 'refund' and p_amount_cents < v_old.amount_cents then
    update public.ownership_ledger set amount_cents = p_amount_cents, updated_at = pg_catalog.now() where entry_key = p_entry_key;
    return 'updated';
  elsif p_kind = 'dispute' and not v_old.final and (v_old.amount_cents <> p_amount_cents or coalesce(p_final, false)) then
    update public.ownership_ledger set amount_cents = p_amount_cents, final = coalesce(p_final, false), updated_at = pg_catalog.now() where entry_key = p_entry_key;
    return 'updated';
  end if;
  return 'unchanged';
end;
$$;
revoke execute on function public.record_ownership_entry(text, uuid, text, text, integer, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.record_ownership_entry(text, uuid, text, text, integer, timestamptz, text, boolean) to service_role;
