-- Admin notify on template pick (Aria scope, Cheke approved, Oct 14 2026). Server-only.
--
-- website_requests.template_pick_version: bumped by the notifier on every saved pick (idempotency key part).
-- website_requests.team_pick_suggestions: the scored team-pick suggestions sent to the admin (audit).
-- template_pick_notify: a durable queue. A self-pick inserts a 'picked' row due now; a change inside the
-- window upserts ONE pending 'changed' row per request with due_at = last change + 2 minutes, so the
-- debounce survives restarts. A processor sends due rows. Unique (request_id, event, pick_version) is the
-- idempotency key; sent rows are never resent. Nothing here is visible to the customer.

alter table public.website_requests add column if not exists template_pick_version integer not null default 0;
alter table public.website_requests add column if not exists team_pick_suggestions jsonb;

create table if not exists public.template_pick_notify (
  id bigserial primary key,
  request_id uuid not null references public.website_requests (id) on delete cascade,
  event text not null check (event in ('picked', 'changed', 'team_pick')),
  pick_version integer not null,
  due_at timestamptz not null,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, event, pick_version)
);
-- At most one pending debounced change per request.
create unique index if not exists template_pick_notify_one_pending_change
  on public.template_pick_notify (request_id) where event = 'changed' and sent_at is null;
create index if not exists template_pick_notify_due_idx on public.template_pick_notify (due_at) where sent_at is null;

alter table public.template_pick_notify enable row level security;
alter table public.template_pick_notify force row level security;
revoke all on table public.template_pick_notify from public, anon, authenticated, service_role;
revoke all on sequence public.template_pick_notify_id_seq from public, anon, authenticated, service_role;
grant select, insert, update on table public.template_pick_notify to service_role;
grant usage on sequence public.template_pick_notify_id_seq to service_role;

-- authenticated has table-level UPDATE on website_requests; the two new columns are server-only.
create or replace function public.website_requests_guard_pick_notify()
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
  if (tg_op = 'INSERT' and (new.template_pick_version <> 0 or new.team_pick_suggestions is not null))
     or (tg_op = 'UPDATE' and (new.template_pick_version is distinct from old.template_pick_version
                               or new.team_pick_suggestions is distinct from old.team_pick_suggestions)) then
    if not (current_user = 'service_role'
            or (current_user in ('postgres', 'supabase_admin')
                and coalesce(jwt_role, '') not in ('anon', 'authenticated'))) then
      raise exception using message = 'pick notify columns are server-only.', errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.website_requests_guard_pick_notify() from public, anon, authenticated;
drop trigger if exists website_requests_guard_pick_notify on public.website_requests;
create trigger website_requests_guard_pick_notify
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_pick_notify();

-- Atomic version bump for the notifier (service role only). Returns the new version.
create or replace function public.template_pick_bump_version(p_request_id uuid)
returns integer
language sql
set search_path = public
as $$
  update public.website_requests set template_pick_version = template_pick_version + 1
   where id = p_request_id returning template_pick_version
$$;
revoke execute on function public.template_pick_bump_version(uuid) from public, anon, authenticated;
grant execute on function public.template_pick_bump_version(uuid) to service_role;
