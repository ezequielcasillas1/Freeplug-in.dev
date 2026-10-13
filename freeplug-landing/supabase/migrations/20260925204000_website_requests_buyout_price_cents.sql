-- Buyout price as a real admin-only column (Ezequiel, Sep 25, 2026).
--
-- Buyout requests live in website_requests (a request is a buyout request when its notes contain
-- "Buyout request (dashboard):"). The owner's price used to be a "Buyout price: $N" line inside the
-- notes, which the customer can also edit (saveWebsiteRequest updates their own row through the
-- website_requests_update_own_open policy). The price now lives only in buyout_price_cents (cents,
-- null = not quoted yet). The app no longer reads any price from notes, and there is deliberately
-- NO backfill from notes: a notes line is customer-editable text and is ignored everywhere. The
-- owner re-enters any price that was quoted before this change.
--
-- Admin-only, enforced in the database (trigger below), not just in the app:
--   * Allowed: service_role (the admin page's server action uses the service-role client), and the
--     owner roles postgres / supabase_admin for migrations and the SQL editor, but only when the
--     request is not a customer API call (no anon / authenticated JWT role), so a SECURITY DEFINER
--     function called by a customer can't set it either.
--   * Rejected (42501): anything else setting it on INSERT or changing it on UPDATE, including
--     authenticated / anon. Customers can still edit their other fields (notes etc.) as before, and
--     can still read the price on their own rows (existing SELECT policy).
-- RLS WITH CHECK can't compare old and new values, hence a trigger rather than a policy.

-- 1) Column + constraint
alter table public.website_requests
  add column if not exists buyout_price_cents integer;

alter table public.website_requests
  drop constraint if exists website_requests_buyout_price_cents_check;
alter table public.website_requests
  add constraint website_requests_buyout_price_cents_check
  check (buyout_price_cents is null or buyout_price_cents >= 0);

comment on column public.website_requests.buyout_price_cents is
  'Owner-set buyout price in cents (null = not quoted yet). Admin-only: only service_role (or the owner role outside a customer API request) may set or change it; enforced by trigger website_requests_guard_buyout_price.';

-- 2) Guard: only the service role may set / change the price
create or replace function public.website_requests_guard_buyout_price()
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
  if tg_op = 'INSERT' and new.buyout_price_cents is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.buyout_price_cents is not distinct from old.buyout_price_cents then
    return new;
  end if;

  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;

  raise exception using
    message = 'buyout_price_cents can only be set by the owner (service role).',
    errcode = '42501';
end;
$$;

revoke execute on function public.website_requests_guard_buyout_price() from public, anon, authenticated;

drop trigger if exists website_requests_guard_buyout_price on public.website_requests;
create trigger website_requests_guard_buyout_price
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_buyout_price();
