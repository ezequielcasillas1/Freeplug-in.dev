-- Buyout flag as a real admin-only column (PENDING Ezequiel's decision; kept separate so it can be
-- dropped). Depends on 20260925204000_website_requests_buyout_price_cents.sql.
--
-- Until now a website request was a "buyout request" when its notes contained the line
-- "Buyout request (dashboard):". Notes are customer-editable (saveWebsiteRequest), so a customer
-- could delete the line (the request stops being a buyout) or paste it into a normal request (it
-- becomes one). From this migration on, is_buyout is the only signal: the admin badge, the admin
-- price action, and the customer "already requested" state all read it; nothing reads the notes line.
--
-- Who can write it (sibling of website_requests_guard_buyout_price, same rule):
--   * service_role: requestBuyoutQuote() sets it with the service-role client after verifying the
--     signed-in user; the owner roles postgres / supabase_admin outside a customer API request.
--   * Anyone else (authenticated / anon, including via a SECURITY DEFINER function a customer calls)
--     gets 42501 when an INSERT sets is_buyout = true or an UPDATE changes it. Normal inserts that
--     leave the default (false) and normal edits that don't touch it keep working.
--
-- One open buyout per customer: website_requests_one_open_per_user (unique on user_id where status
-- is submitted / in_review) already allows only one open request per customer, whatever its notes
-- say, so at most one open request can have is_buyout = true. That index never depended on notes
-- and is unchanged. A buyout price only makes sense on a buyout request, so the price column now
-- requires is_buyout (check constraint below).

-- 1) Column
alter table public.website_requests
  add column if not exists is_buyout boolean not null default false;

comment on column public.website_requests.is_buyout is
  'True when the customer asked for a buyout quote ("Request a buyout quote"). Admin-only: set by the service role; customers cannot set or change it (trigger website_requests_guard_is_buyout). The notes line is informational only.';

-- 2) Guard trigger (sibling of website_requests_guard_buyout_price)
create or replace function public.website_requests_guard_is_buyout()
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
  if tg_op = 'INSERT' and new.is_buyout is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.is_buyout is not distinct from old.is_buyout then
    return new;
  end if;

  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;

  raise exception using
    message = 'is_buyout can only be set by the server (service role).',
    errcode = '42501';
end;
$$;

revoke execute on function public.website_requests_guard_is_buyout() from public, anon, authenticated;

drop trigger if exists website_requests_guard_is_buyout on public.website_requests;
create trigger website_requests_guard_is_buyout
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_is_buyout();

-- 3) One-time backfill: existing requests that carry the dashboard buyout line. Runs as the owner
--    (no customer JWT), so the guard allows it. updated_at and notes are left unchanged.
update public.website_requests
set is_buyout = true
where is_buyout = false
  and notes like '%Buyout request (dashboard):%';

-- 4) A price only on a buyout request
alter table public.website_requests
  drop constraint if exists website_requests_buyout_price_requires_is_buyout;
alter table public.website_requests
  add constraint website_requests_buyout_price_requires_is_buyout
  check (buyout_price_cents is null or is_buyout);
