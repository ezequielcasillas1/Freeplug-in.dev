-- Where a website request came from: 'organic' (the customer used the request form; every row
-- before this migration) or 'outreach' (created by the claim RPC for a site we built first).
-- Existing checkout eligibility (isPlansCheckoutAllowed counts website_requests rows) and the
-- admin lists keep working unchanged; the organic flow is untouched (default 'organic').
--
-- source and outreach_site_id can only be set by the server: a customer insert through the API
-- must use the defaults, and a customer update can't change them (trigger, 42501).

alter table public.website_requests
  add column if not exists source text not null default 'organic';

alter table public.website_requests
  drop constraint if exists website_requests_source_check;
alter table public.website_requests
  add constraint website_requests_source_check check (source in ('organic', 'outreach'));

alter table public.website_requests
  add column if not exists outreach_site_id uuid references public.outreach_sites (id) on delete set null;

create index if not exists website_requests_outreach_site_idx
  on public.website_requests (outreach_site_id) where outreach_site_id is not null;

create or replace function public.website_requests_guard_source()
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
  if tg_op = 'INSERT' and new.source = 'organic' and new.outreach_site_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.source is not distinct from old.source
     and new.outreach_site_id is not distinct from old.outreach_site_id then
    return new;
  end if;
  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;
  raise exception using
    message = 'source can only be set by the server (service role).',
    errcode = '42501';
end;
$$;

revoke execute on function public.website_requests_guard_source() from public, anon, authenticated;

drop trigger if exists website_requests_guard_source on public.website_requests;
create trigger website_requests_guard_source
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_source();
