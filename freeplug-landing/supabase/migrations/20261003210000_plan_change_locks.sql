-- Change-plan lock (Aria, Oct 3 2026): one plan change per customer at a time.
--
-- Two Confirms at once (two tabs, a double tap that outran the button, a retry) must not both reach
-- Stripe: with a downgrade pending, both would release the schedule and upgrade. The server claims
-- a per-user row BEFORE any Stripe call and releases it in a finally block. A second change-plan
-- while the row is held gets UPGRADE_IN_PROGRESS and never calls Stripe. No retry, no waiting.
--
-- Same claim-before-act pattern as email_sends (20261003160000):
--   plan_change_lock_claim(user, ttl): one INSERT ... ON CONFLICT (user_id) DO UPDATE ... WHERE the
--     existing row has expired, RETURNING claim_id. A row comes back = the caller holds the lock;
--     NULL = someone else holds it. One statement, so two concurrent claims can't both win (the
--     second waits for the first to commit, then sees an unexpired row and gets nothing).
--   plan_change_lock_release(user, claim_id): deletes the row only if it is still this claim (an
--     expired claim taken over by another request is left alone).
-- The 60 s expiry (set by the app) covers a crash between claim and release: the next request after
-- that takes the row over. Both functions run as the caller (service_role).
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / guarded policies; re-running changes nothing.
-- LOCAL ONLY for now: part of the r13 hosted set (applied hosted only after Vera's retest and
-- Ezequiel's go). The app fails CLOSED without it (no plan change runs if the lock can't be claimed),
-- so it must be applied before the code that uses it is deployed.

create table if not exists public.plan_change_locks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  claim_id uuid not null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint plan_change_locks_expiry_check check (expires_at > claimed_at and expires_at <= claimed_at + interval '10 minutes')
);

comment on table public.plan_change_locks is
  'Change-plan lock: at most one plan or tip change per customer at a time (claimed before any Stripe call, released in finally, 60 s expiry). No personal data beyond the user id.';

alter table public.plan_change_locks enable row level security;
alter table public.plan_change_locks force row level security;

-- Nothing for PUBLIC / anon / authenticated. service_role: what the claim and release need.
revoke all on table public.plan_change_locks from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.plan_change_locks to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plan_change_locks' and policyname = 'plan_change_locks_service_role_all'
  ) then
    create policy plan_change_locks_service_role_all on public.plan_change_locks
      for all to service_role using (true) with check (true);
  end if;
end
$$;

-- Claim the lock for a user. Returns the claim id, or NULL when another request holds it.
create or replace function public.plan_change_lock_claim(p_user_id uuid, p_ttl_seconds integer default 60)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim uuid;
begin
  if p_user_id is null or p_ttl_seconds is null or p_ttl_seconds < 1 or p_ttl_seconds > 600 then
    raise exception using message = 'plan_change_lock_claim: invalid arguments', errcode = '22023';
  end if;

  insert into public.plan_change_locks as l (user_id, claim_id, claimed_at, expires_at)
  values (
    p_user_id,
    pg_catalog.gen_random_uuid(),
    pg_catalog.now(),
    pg_catalog.now() + pg_catalog.make_interval(secs => p_ttl_seconds)
  )
  on conflict (user_id) do update
     set claim_id = excluded.claim_id,
         claimed_at = excluded.claimed_at,
         expires_at = excluded.expires_at
   where l.expires_at <= pg_catalog.now()
  returning l.claim_id into v_claim;

  return v_claim;
end;
$$;

revoke execute on function public.plan_change_lock_claim(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.plan_change_lock_claim(uuid, integer) to service_role;

-- Release a claim. Returns whether this claim's row was removed.
create or replace function public.plan_change_lock_release(p_user_id uuid, p_claim_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null or p_claim_id is null then
    raise exception using message = 'plan_change_lock_release: invalid arguments', errcode = '22023';
  end if;
  delete from public.plan_change_locks where user_id = p_user_id and claim_id = p_claim_id;
  return found;
end;
$$;

revoke execute on function public.plan_change_lock_release(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.plan_change_lock_release(uuid, uuid) to service_role;
