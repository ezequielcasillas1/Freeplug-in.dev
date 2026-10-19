-- Oct 18 QA follow-up (on top of 20261018090000, which stays as first written):
-- 1) maintenance_quotes.amount_cents is limited to $50-$100 in the database too (was > 0 and <= 1,000,000).
-- 2) record_ownership_entry: refunds are keyed per Stripe refund id (Aria). A refund row's latest state wins until
--    it is final (failed/canceled -> 0, final); replays change nothing. Same rule as src/lib/buyout/ownership.ts.
alter table public.maintenance_quotes drop constraint if exists maintenance_quotes_amount_cents_check;
alter table public.maintenance_quotes drop constraint if exists maintenance_quotes_amount_range;
alter table public.maintenance_quotes
  add constraint maintenance_quotes_amount_range check (amount_cents between 5000 and 10000);

-- Idempotent upsert. Returns 'inserted' | 'updated' | 'unchanged'. Service role only.
--   payment: first write wins, except an invoice amount (before tax) replaces a raw charge amount.
--   refund : one row per refund id; latest state wins until final (failed/canceled -> 0, final).
--   dispute: latest non-final state wins; once final (won -> 0, lost -> negative) it never changes.
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
  elsif p_kind = 'refund' and not v_old.final and (v_old.amount_cents <> p_amount_cents or coalesce(p_final, false)) then
    update public.ownership_ledger set amount_cents = p_amount_cents, final = coalesce(p_final, false), updated_at = pg_catalog.now() where entry_key = p_entry_key;
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
