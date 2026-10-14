-- Template pick window, follow-up (Aria rulings, Oct 13 8:44 PM).
--
-- 1. Older picks: backfill template_first_picked_at from template_picked_at. Their hour has long passed,
--    so this LOCKS them (the customer sees the read-only view). A row that still has a pick but a NULL
--    template_first_picked_at also counts as closed (template_pick_window_open now takes template_choice).
--    Admin "Unlock for 1 hour" is the way out.
-- 2. Both Lock and Unlock write template_pick_audit (actor, action, request id, time) in the same transaction.

-- New window rule: a pick with no first-pick time is closed unless unlocked.
create or replace function public.template_pick_window_open(
  p_status text, p_locked_at timestamptz, p_first_picked_at timestamptz, p_unlocked_until timestamptz, p_at timestamptz,
  p_template_choice text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_status in ('submitted', 'in_review'), false)
     and p_locked_at is null
     and (
       (p_first_picked_at is null and p_template_choice is null)
       or (p_first_picked_at is not null and p_at < p_first_picked_at + interval '65 minutes')
       or (p_unlocked_until is not null and p_at < p_unlocked_until)
     )
$$;
revoke execute on function public.template_pick_window_open(text, timestamptz, timestamptz, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.template_pick_window_open(text, timestamptz, timestamptz, timestamptz, timestamptz, text) to service_role;

-- Guard: same as 20261013200000, but the closed-window check passes old.template_choice.
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
  if not (current_user = 'service_role'
          or (current_user in ('postgres', 'supabase_admin')
              and coalesce(jwt_role, '') not in ('anon', 'authenticated'))) then
    raise exception using
      message = 'template pick can only be set by the server (service role).',
      errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.template_first_picked_at is not null
     and new.template_first_picked_at is distinct from old.template_first_picked_at then
    raise exception using message = 'template_first_picked_at is set once.', errcode = '42501';
  end if;
  if pick_changed and not public.template_pick_window_open(
       old.status, old.template_locked_at, old.template_first_picked_at, old.template_unlocked_until, now(),
       old.template_choice) then
    raise exception using message = 'template pick window is closed.', errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.website_requests_guard_template_pick() from public, anon, authenticated;

-- The 5-argument version is no longer used.
drop function if exists public.template_pick_window_open(text, timestamptz, timestamptz, timestamptz, timestamptz);

-- Backfill (Aria ruling 1): older picks get their first-pick time, which closes their window.
-- Runs as the migration owner (no JWT), so the guard allows it; null -> value is allowed by set-once.
update public.website_requests
   set template_first_picked_at = template_picked_at
 where template_first_picked_at is null
   and template_choice is not null
   and template_picked_at is not null;

-- Audit: lock as well as unlock.
alter table public.template_pick_audit drop constraint if exists template_pick_audit_action_check;
alter table public.template_pick_audit add constraint template_pick_audit_action_check check (action in ('unlock', 'lock'));

-- Admin lock, atomic with its audit row. Returns the lock time, or null if nothing was locked
-- (already locked, or no pick).
create or replace function public.template_pick_admin_lock(p_request_id uuid, p_actor_email text)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  at_ts timestamptz := now();
  n int;
begin
  if coalesce(btrim(p_actor_email), '') = '' then
    raise exception using message = 'actor required', errcode = '22023';
  end if;
  update public.website_requests
     set template_locked_at = at_ts
   where id = p_request_id
     and template_locked_at is null
     and template_choice is not null;
  get diagnostics n = row_count;
  if n = 0 then
    return null;
  end if;
  insert into public.template_pick_audit (request_id, action, actor_email)
  values (p_request_id, 'lock', p_actor_email);
  return at_ts;
end;
$$;
revoke execute on function public.template_pick_admin_lock(uuid, text) from public, anon, authenticated;
grant execute on function public.template_pick_admin_lock(uuid, text) to service_role;
