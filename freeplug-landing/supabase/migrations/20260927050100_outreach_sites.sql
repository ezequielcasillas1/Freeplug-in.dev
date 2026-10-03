-- Outreach sites: businesses we built a website for before they asked (outreach claim flow).
--
-- One row per prebuilt site. The private preview link carries a random 32-byte token; only its
-- SHA-256 (hex) is stored here, and lookups are by exact hash only (Aria, section 3). The link is
-- valid while: not revoked, not claimed, and expires_at is in the future. Every other state shows
-- the same 404.
--
-- Server-only table: anon and authenticated have no privileges at all (the app reads and writes it
-- through the service-role module src/lib/outreach/server.ts). The guard trigger below also
-- rejects (42501) any write that is not from the service role, as a second layer in case grants
-- are ever added back.

create table if not exists public.outreach_sites (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (length(trim(business_name)) between 1 and 200),
  contact_email text check (contact_email is null or length(contact_email) <= 320),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  declined_at timestamptz,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  -- Full-page screenshots in the private "outreach" storage bucket (never public URLs).
  screenshot_desktop_path text check (screenshot_desktop_path is null or length(screenshot_desktop_path) <= 300),
  screenshot_mobile_path text check (screenshot_mobile_path is null or length(screenshot_mobile_path) <= 300),
  -- Details found online, each {"value": "...", "source": "Thumbtack profile"}; keys:
  -- phone, address, hours, service_area, quote_email.
  prefill jsonb not null default '{}'::jsonb check (jsonb_typeof(prefill) = 'object'),
  services text[] not null default '{}' check (coalesce(array_length(services, 1), 0) <= 50),
  -- Admin-only provenance from Rio's import: [{"name", "source_label", "source_url"}] for services,
  -- and prefill entries may carry "source_url". The preview page never receives source_url.
  service_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(service_sources) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_sites_token_hash_key on public.outreach_sites (token_hash);
create index if not exists outreach_sites_claimed_by_idx on public.outreach_sites (claimed_by)
  where claimed_by is not null;
create index if not exists outreach_sites_created_at_idx on public.outreach_sites (created_at desc);

alter table public.outreach_sites enable row level security;
revoke all on table public.outreach_sites from public, anon, authenticated;
grant select, insert, update, delete on table public.outreach_sites to service_role;

-- Shared guard: only the service role (or the owner role outside a customer API request, i.e.
-- migrations / SQL editor / SECURITY DEFINER functions called by the service role) may write.
-- Same rule as website_requests_guard_buyout_price.
create or replace function public.outreach_guard_service_role_only()
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
  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return coalesce(new, old);
  end if;
  raise exception using
    message = tg_table_name || ' can only be changed by the server (service role).',
    errcode = '42501';
end;
$$;

revoke execute on function public.outreach_guard_service_role_only() from public, anon, authenticated;

drop trigger if exists outreach_sites_guard on public.outreach_sites;
create trigger outreach_sites_guard
  before insert or update or delete on public.outreach_sites
  for each row execute function public.outreach_guard_service_role_only();

-- Append-only event log for the preview ("Not right now"). The preview only ever INSERTs here; a
-- trigger copies the first "declined" time onto the site row.
create table if not exists public.outreach_site_events (
  id uuid primary key default gen_random_uuid(),
  outreach_site_id uuid not null references public.outreach_sites (id) on delete cascade,
  kind text not null check (kind in ('declined')),
  created_at timestamptz not null default now()
);

create index if not exists outreach_site_events_site_idx on public.outreach_site_events (outreach_site_id);

alter table public.outreach_site_events enable row level security;
revoke all on table public.outreach_site_events from public, anon, authenticated;
grant select, insert on table public.outreach_site_events to service_role;

create or replace function public.outreach_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using
    message = tg_table_name || ' is append-only.',
    errcode = '42501';
end;
$$;

revoke execute on function public.outreach_append_only() from public, anon, authenticated;

drop trigger if exists outreach_site_events_append_only on public.outreach_site_events;
create trigger outreach_site_events_append_only
  before update or delete on public.outreach_site_events
  for each row execute function public.outreach_append_only();

drop trigger if exists outreach_site_events_guard on public.outreach_site_events;
create trigger outreach_site_events_guard
  before insert on public.outreach_site_events
  for each row execute function public.outreach_guard_service_role_only();

create or replace function public.outreach_site_events_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'declined' then
    update public.outreach_sites
    set declined_at = coalesce(declined_at, new.created_at), updated_at = now()
    where id = new.outreach_site_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.outreach_site_events_apply() from public, anon, authenticated;

drop trigger if exists outreach_site_events_apply on public.outreach_site_events;
create trigger outreach_site_events_apply
  after insert on public.outreach_site_events
  for each row execute function public.outreach_site_events_apply();
