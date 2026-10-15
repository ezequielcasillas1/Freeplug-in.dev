-- Phase 4 L-2: invoice.paid's ledger row and the cumulative paid total in ONE transaction.
-- The ledger row is unique on stripe_invoice_id; a duplicate (redelivery, or another event for the same
-- invoice) inserts nothing and leaves the total alone. The total is incremented in place (no
-- read-modify-write), so two different invoices paid at the same moment both count.
-- Returns true when the row was recorded, false for a duplicate. Raises when the profile does not exist
-- (the route looks it up first). Service role only; runs as the caller (no SECURITY DEFINER), empty
-- search_path with every reference qualified. Not applied to any hosted project by this change.
create or replace function public.record_invoice_paid(
  p_profile_id uuid,
  p_stripe_invoice_id text,
  p_amount_cents integer,
  p_tip_cents integer default 0,
  p_paid_at timestamptz default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_profile_id is null or p_stripe_invoice_id is null or length(p_stripe_invoice_id) = 0
     or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using message = 'record_invoice_paid: invalid arguments', errcode = '22023';
  end if;

  insert into public.billing_ledger (profile_id, stripe_invoice_id, amount_cents, tip_cents, created_at)
  values (
    p_profile_id,
    p_stripe_invoice_id,
    p_amount_cents,
    least(greatest(coalesce(p_tip_cents, 0), 0), p_amount_cents),
    coalesce(p_paid_at, pg_catalog.now())
  )
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;

  if v_id is null then
    return false; -- duplicate: no row, no increment
  end if;

  update public.profiles
     set cumulative_website_value_paid_cents = coalesce(cumulative_website_value_paid_cents, 0) + p_amount_cents,
         updated_at = pg_catalog.now()
   where id = p_profile_id;
  if not found then
    raise exception using message = 'record_invoice_paid: profile not found', errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke execute on function public.record_invoice_paid(uuid, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.record_invoice_paid(uuid, text, integer, integer, timestamptz) to service_role;
