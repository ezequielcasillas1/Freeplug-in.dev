-- Add-ons (Oct 4 2026): counting the add-on edits.
-- Depends on 20261003180000_plan_steps.sql (included_edit_uses, website_requests).
--
--   1. included_edit_uses allows up to 2 small edits per user per billing period (the step's
--      included edit + the "+1 small edit" add-on). The one-per-period UNIQUE becomes
--      UNIQUE (user_id, period_start, slot) with slot 1..2. HOW MANY a customer may use is the
--      server's entitlement (src/lib/plans/included-edits.ts tries slots 1..includedEditsPerMonth);
--      the database caps it at 2 and still stops a request being counted twice (request_id unique).
--      Existing rows become slot 1 (the default), so nothing already used changes meaning.
--   2. big_change_uses: the Big change add-on, one per user per billing period. Same shape, grants
--      and RLS as included_edit_uses (service role inserts, the owner reads their own rows).
--   3. One request is never counted in both tables: a BEFORE INSERT trigger on each table takes a
--      transaction advisory lock on the request id and refuses (SQLSTATE FP409) when the other table
--      already has it. The lock serialises two concurrent inserts of the same request.
--
-- Idempotent: IF NOT EXISTS / drop-then-add constraints / CREATE OR REPLACE / guarded policies.
-- LOCAL ONLY: not applied anywhere hosted.

-- 1) included_edit_uses: slots -------------------------------------------------------------------
alter table public.included_edit_uses
  add column if not exists slot smallint not null default 1;
alter table public.included_edit_uses
  drop constraint if exists included_edit_uses_slot_check;
alter table public.included_edit_uses
  add constraint included_edit_uses_slot_check check (slot between 1 and 2);
alter table public.included_edit_uses
  drop constraint if exists included_edit_uses_user_period_key;
alter table public.included_edit_uses
  drop constraint if exists included_edit_uses_user_period_slot_key;
alter table public.included_edit_uses
  add constraint included_edit_uses_user_period_slot_key unique (user_id, period_start, slot);
comment on column public.included_edit_uses.slot is
  'Add-ons (Oct 4): 1 = the first small edit used this period, 2 = the second (the +1 small edit add-on). The server only uses slots up to the customer''s entitlement.';
comment on table public.included_edit_uses is
  'Included small edits used (Fast lane and up, grandfathered Plus/Pro, the +1 small edit add-on): one row per edit, at most 2 per user per billing period (slot). Written by the service role (admin action); customers read their own rows.';

-- 2) big_change_uses -----------------------------------------------------------------------------
create table if not exists public.big_change_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The subscription's current_period_start (UTC date) when the big change was used.
  period_start date not null,
  request_id uuid null references public.website_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint big_change_uses_user_period_key unique (user_id, period_start),
  constraint big_change_uses_request_id_key unique (request_id)
);

comment on table public.big_change_uses is
  'Big change add-on used (one larger edit of up to about an hour): one row per user per billing period. Written by the service role (admin action); customers read their own rows.';

alter table public.big_change_uses enable row level security;
alter table public.big_change_uses force row level security;

revoke all on table public.big_change_uses from public, anon, authenticated, service_role;
grant select on table public.big_change_uses to authenticated;
grant select, insert on table public.big_change_uses to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'big_change_uses' and policyname = 'big_change_uses_select_own'
  ) then
    create policy big_change_uses_select_own on public.big_change_uses
      for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'big_change_uses' and policyname = 'big_change_uses_service_role_all'
  ) then
    create policy big_change_uses_service_role_all on public.big_change_uses
      for all to service_role using (true) with check (true);
  end if;
end
$$;

-- 3) one request, one table ----------------------------------------------------------------------
create or replace function public.edit_uses_request_once()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.request_id is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('edit_uses:' || new.request_id::text));
  if tg_table_name = 'included_edit_uses'
     and exists (select 1 from public.big_change_uses b where b.request_id = new.request_id) then
    raise exception using message = 'This request is already counted as a big change.', errcode = 'FP409';
  end if;
  if tg_table_name = 'big_change_uses'
     and exists (select 1 from public.included_edit_uses i where i.request_id = new.request_id) then
    raise exception using message = 'This request is already counted as a small edit.', errcode = 'FP409';
  end if;
  return new;
end;
$$;

revoke all on function public.edit_uses_request_once() from public, anon, authenticated, service_role;
-- (no grant: trigger function, called by no role)

drop trigger if exists included_edit_uses_request_once on public.included_edit_uses;
create trigger included_edit_uses_request_once
  before insert on public.included_edit_uses
  for each row execute function public.edit_uses_request_once();

drop trigger if exists big_change_uses_request_once on public.big_change_uses;
create trigger big_change_uses_request_once
  before insert on public.big_change_uses
  for each row execute function public.edit_uses_request_once();
