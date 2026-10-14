-- Template pick 1-hour window (Aria ruling, Oct 13 2026; Cheke 8:24 PM: server window 65 minutes,
-- a silent 5-minute grace past the "1 hour" the customer is told).
--
-- The pick may change only while status in ('submitted','in_review') AND template_locked_at is null AND
-- db now() < template_first_picked_at + 65 minutes, OR now() < template_unlocked_until (admin "Unlock",
-- also 65 minutes). template_locked_at always wins. Before the first pick the window has not started.
-- template_first_picked_at is set once on the first pick and never reset; a re-pick does not extend it.
--
-- Backstop: the guard trigger (replaces 20261012180000's function, same trigger) still refuses every
-- anon/authenticated write to the template columns (now including the two new ones), and for ANY role
-- refuses a pick or business_type change once the window is closed, and any change to
-- template_first_picked_at once set. The server action (src/lib/templates/pick.ts) enforces the same
-- rule with the db clock (template_pick_db_now) and the constants in src/lib/templates/window.ts.

alter table public.website_requests add column if not exists template_first_picked_at timestamptz;
alter table public.website_requests add column if not exists template_unlocked_until timestamptz;

-- Window rule in one place (65 = PICK_WINDOW_SERVER_MINUTES in src/lib/templates/window.ts).
create or replace function public.template_pick_window_open(
  p_status text, p_locked_at timestamptz, p_first_picked_at timestamptz, p_unlocked_until timestamptz, p_at timestamptz
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_status in ('submitted', 'in_review'), false)
     and p_locked_at is null
     and (
       p_first_picked_at is null
       or p_at < p_first_picked_at + interval '65 minutes'
       or (p_unlocked_until is not null and p_at < p_unlocked_until)
     )
$$;

-- The db clock for the server action, so app-server clock skew can't widen the window.
create or replace function public.template_pick_db_now()
returns timestamptz
language sql
stable
set search_path = public
as $$ select now() $$;

revoke execute on function public.template_pick_window_open(text, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.template_pick_db_now() from public, anon, authenticated;
grant execute on function public.template_pick_window_open(text, timestamptz, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.template_pick_db_now() to service_role;

create or replace function public.website_requests_guard_template_pick()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
  pick_changed boolean;
begin
  if tg_op = 'INSERT' and new.business_type is null and new.template_choice is null
     and new.envato_item_id is null and new.pasted_template_url is null
     and new.template_picked_at is null and new.template_locked_at is null
     and new.template_first_picked_at is null and new.template_unlocked_until is null then
    return new;
  end if;
  pick_changed := tg_op = 'UPDATE' and (
    new.business_type is distinct from old.business_type
    or new.template_choice is distinct from old.template_choice
    or new.envato_item_id is distinct from old.envato_item_id
    or new.pasted_template_url is distinct from old.pasted_template_url
    or new.template_picked_at is distinct from old.template_picked_at
  );
  if tg_op = 'UPDATE' and not pick_changed
     and new.template_locked_at is not distinct from old.template_locked_at
     and new.template_first_picked_at is not distinct from old.template_first_picked_at
     and new.template_unlocked_until is not distinct from old.template_unlocked_until then
    return new;
  end if;
  -- 1. Direct client writes (anon/authenticated) never touch the template columns.
  if not (current_user = 'service_role'
          or (current_user in ('postgres', 'supabase_admin')
              and coalesce(jwt_role, '') not in ('anon', 'authenticated'))) then
    raise exception using
      message = 'template pick can only be set by the server (service role).',
      errcode = '42501';
  end if;
  -- 2. template_first_picked_at is written once and never changed (a re-pick doesn't extend the window).
  if tg_op = 'UPDATE' and old.template_first_picked_at is not null
     and new.template_first_picked_at is distinct from old.template_first_picked_at then
    raise exception using message = 'template_first_picked_at is set once.', errcode = '42501';
  end if;
  -- 3. Any role: no pick or business_type change once the window is closed (locked always wins).
  if pick_changed and not public.template_pick_window_open(
       old.status, old.template_locked_at, old.template_first_picked_at, old.template_unlocked_until, now()) then
    raise exception using message = 'template pick window is closed.', errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.website_requests_guard_template_pick() from public, anon, authenticated;

drop trigger if exists website_requests_guard_template_pick on public.website_requests;
create trigger website_requests_guard_template_pick
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_template_pick();

-- Admin "Unlock for 1 hour" audit (who/when). There is no general admin audit table on this branch, so
-- this small append-only log follows template_widen_log's pattern (service role only, FORCE RLS).
create table if not exists public.template_pick_audit (
  id bigserial primary key,
  request_id uuid not null,
  action text not null check (action in ('unlock')),
  actor_email text not null,
  unlocked_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists template_pick_audit_request_idx on public.template_pick_audit (request_id, created_at desc);
alter table public.template_pick_audit enable row level security;
alter table public.template_pick_audit force row level security;
revoke all on table public.template_pick_audit from public, anon, authenticated, service_role;
revoke all on sequence public.template_pick_audit_id_seq from public, anon, authenticated, service_role;
grant select, insert on table public.template_pick_audit to service_role;
grant usage on sequence public.template_pick_audit_id_seq to service_role;

-- Admin unlock, atomic: refuses a locked or closed-status request; sets unlocked_until = db now() + 65 min
-- and writes the audit row in the same transaction. Returns the new unlocked_until, or null if refused.
create or replace function public.template_pick_admin_unlock(p_request_id uuid, p_actor_email text)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  until_at timestamptz := now() + interval '65 minutes';
  n int;
begin
  if coalesce(btrim(p_actor_email), '') = '' then
    raise exception using message = 'actor required', errcode = '22023';
  end if;
  update public.website_requests
     set template_unlocked_until = until_at
   where id = p_request_id
     and template_locked_at is null
     and status in ('submitted', 'in_review');
  get diagnostics n = row_count;
  if n = 0 then
    return null;
  end if;
  insert into public.template_pick_audit (request_id, action, actor_email, unlocked_until)
  values (p_request_id, 'unlock', p_actor_email, until_at);
  return until_at;
end;
$$;
revoke execute on function public.template_pick_admin_unlock(uuid, text) from public, anon, authenticated;
grant execute on function public.template_pick_admin_unlock(uuid, text) to service_role;
