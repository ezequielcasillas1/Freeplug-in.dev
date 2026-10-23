-- Consultation step (Aria's card, Oct 22 2026; Cheke approved 8:02 PM CT). TEST MODE ONLY until Cheke's yes.
--
-- Flow: submitted -> in_review -> consultation -> agreed -> building -> closed.
-- A client picks one of two consultation paths for their open website request:
--   form: the client fills the detailed checklist themselves (prepared_by = 'client')
--   live: the client books a phone / FaceTime / webcam / text session; afterwards the team fills
--         the same checklist from the admin side (prepared_by = 'team') and the client reviews it.
-- Both paths end with the client's "Looks good", which stamps agreed_at / agreed_ip (server only)
-- and moves the request to 'agreed'. Only then may it move to 'building' (trigger below).

-- 1) website_requests: new statuses, and they count as "open" (one open request per customer).
-- 0) ONE shared definition of "open" and "pre-agreement" (Aria's ruling, Oct 22 r2): open = any
--    status other than closed. Every SQL check below (and the redefined older RPCs in section 10) calls
--    these; the TS side is OPEN_REQUEST_STATUSES / PRE_AGREEMENT_STATUSES in lib/consultation/status.ts.
--    src/lib/consultation/open-status-sync.test.ts fails if the two sides drift.
create or replace function public.website_request_is_open(p_status text)
returns boolean
language sql
immutable
parallel safe
as $$ select p_status is not null and p_status <> 'closed' $$;

create or replace function public.website_request_is_pre_agreement(p_status text)
returns boolean
language sql
immutable
parallel safe
as $$ select p_status in ('submitted', 'in_review', 'consultation') $$;

grant execute on function public.website_request_is_open(text) to anon, authenticated, service_role;
grant execute on function public.website_request_is_pre_agreement(text) to anon, authenticated, service_role;

alter table public.website_requests drop constraint if exists website_requests_status_check;
alter table public.website_requests
  add constraint website_requests_status_check
  check (status in ('submitted', 'in_review', 'consultation', 'agreed', 'building', 'closed'));

drop index if exists public.website_requests_one_open_per_user;
create unique index website_requests_one_open_per_user
  on public.website_requests (user_id)
  where public.website_request_is_open(status);

-- 2) consultations: one per request.
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.website_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (path in ('form', 'live')),
  live_method text check (live_method in ('phone', 'facetime', 'webcam', 'text')),
  contact_number text check (contact_number is null or length(contact_number) <= 40),
  booking_ref text check (booking_ref is null or length(booking_ref) <= 500),
  booked_at timestamptz,
  checklist jsonb not null default '{}'::jsonb,
  prepared_by text not null default 'client' check (prepared_by in ('client', 'team')),
  ready_for_review_at timestamptz,
  agreed_at timestamptz,
  agreed_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultations_live_method_matches_path
    check ((path = 'live') = (live_method is not null)),
  constraint consultations_agreed_needs_review
    check (agreed_at is null or ready_for_review_at is not null)
);

create index if not exists consultations_user_id_idx on public.consultations (user_id);

-- 3) consent log (append-only): phone or text contact needs a ticked consent box, logged with a timestamp.
create table if not exists public.consultation_consents (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('phone', 'text')),
  phone_number text not null check (length(phone_number) between 7 and 40),
  consent_text text not null check (length(consent_text) between 1 and 2000),
  consented_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists consultation_consents_consultation_idx
  on public.consultation_consents (consultation_id);

-- 4) RLS. Clients read their own rows and may write their own consultation only until it is agreed.
alter table public.consultations enable row level security;
alter table public.consultation_consents enable row level security;

drop policy if exists "consultations_select_own" on public.consultations;
create policy "consultations_select_own" on public.consultations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "consultations_insert_own" on public.consultations;
create policy "consultations_insert_own" on public.consultations
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and agreed_at is null
    and agreed_ip is null
    and prepared_by = 'client'
    and exists (
      select 1 from public.website_requests r
      where r.id = request_id and r.user_id = auth.uid()
        and public.website_request_is_pre_agreement(r.status)
    )
  );

drop policy if exists "consultations_update_own_until_agreed" on public.consultations;
create policy "consultations_update_own_until_agreed" on public.consultations
  for update to authenticated
  using (auth.uid() = user_id and agreed_at is null)
  with check (auth.uid() = user_id and agreed_at is null);

drop policy if exists "consultation_consents_select_own" on public.consultation_consents;
create policy "consultation_consents_select_own" on public.consultation_consents
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "consultation_consents_insert_own" on public.consultation_consents;
create policy "consultation_consents_insert_own" on public.consultation_consents
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.consultations c
      where c.id = consultation_id and c.user_id = auth.uid() and c.agreed_at is null
    )
  );

grant select, insert, update on public.consultations to authenticated;
grant select, insert on public.consultation_consents to authenticated;
grant all on public.consultations to service_role;
grant all on public.consultation_consents to service_role;

-- 5) Guard columns clients must never set: agreement stamp, owner, request, team-prepared flag.
create or replace function public.consultations_guard_client_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  -- A live session's summary is written by the team; the client can't mark it ready themselves.
  if new.path = 'live' and new.ready_for_review_at is not null
     and (tg_op = 'INSERT' or old.ready_for_review_at is null or new.path is distinct from old.path)
     and (tg_op = 'INSERT' or old.prepared_by = 'client') then
    raise exception using message = 'Your summary will be ready after your live session.', errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.agreed_at is distinct from old.agreed_at
       or new.agreed_ip is distinct from old.agreed_ip
       or new.user_id is distinct from old.user_id
       or new.request_id is distinct from old.request_id
       or new.prepared_by is distinct from old.prepared_by then
      raise exception using message = 'This consultation field can only be changed by Freeplug.', errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_guard_client_writes on public.consultations;
create trigger consultations_guard_client_writes
  before insert or update on public.consultations
  for each row execute function public.consultations_guard_client_writes();

-- 6) The gate: a request can be 'agreed' or 'building' only with an agreed consultation.
create or replace function public.website_requests_require_agreed_consultation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('agreed', 'building')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    if not exists (
      select 1 from public.consultations c
      where c.request_id = new.id and c.agreed_at is not null
    ) then
      raise exception using
        message = 'Building cannot start until the client clicks Looks good on their consultation summary.',
        errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists website_requests_require_agreed_consultation on public.website_requests;
create trigger website_requests_require_agreed_consultation
  before insert or update of status on public.website_requests
  for each row execute function public.website_requests_require_agreed_consultation();

-- 7) Server RPCs (service_role only; the app verifies the signed-in user / admin first).

-- Team saves the checklist after a live session; p_ready = true sends it to the client for review.
create or replace function public.admin_save_consultation_checklist(
  p_consultation_id uuid,
  p_checklist jsonb,
  p_ready boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'object' then
    raise exception using message = 'Checklist must be an object.', errcode = 'P0001';
  end if;
  update public.consultations
  set checklist = p_checklist,
      prepared_by = 'team',
      ready_for_review_at = case when p_ready then now() else ready_for_review_at end,
      updated_at = now()
  where id = p_consultation_id and agreed_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using message = 'Consultation not found or already agreed.', errcode = 'P0001';
  end if;
end;
$$;

-- Client clicks "Looks good": stamp agreed_at / agreed_ip and move the request to 'agreed'.
create or replace function public.agree_consultation_for_user(
  p_consultation_id uuid,
  p_user_id uuid,
  p_ip text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request uuid;
  v_at timestamptz := now();
begin
  update public.consultations
  set agreed_at = v_at, agreed_ip = left(p_ip, 100), updated_at = v_at
  where id = p_consultation_id
    and user_id = p_user_id
    and agreed_at is null
    and ready_for_review_at is not null
  returning request_id into v_request;
  if v_request is null then
    raise exception using message = 'This summary is not ready to agree yet.', errcode = 'P0001';
  end if;
  update public.website_requests
  set status = 'agreed', updated_at = v_at
  where id = v_request and public.website_request_is_pre_agreement(status);
  update public.profiles
  set evaluation_status = 'agreed', evaluation_progress = greatest(evaluation_progress, 75), updated_at = v_at
  where id = p_user_id;
  return v_at;
end;
$$;

revoke execute on function public.admin_save_consultation_checklist(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.admin_save_consultation_checklist(uuid, jsonb, boolean) to service_role;
revoke execute on function public.agree_consultation_for_user(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agree_consultation_for_user(uuid, uuid, text) to service_role;

-- 8) Closing an open request covers every open status (Aria's ruling, Oct 22 r2: open = not closed).
create or replace function public.cancel_website_request_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if p_user_id is null then
    raise exception using message = 'No open request to close.', errcode = 'P0001';
  end if;
  update public.website_requests
  set status = 'closed', updated_at = now()
  where user_id = p_user_id
    and public.website_request_is_open(status);
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using message = 'No open request to close.', errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.cancel_website_request_for_user(uuid) from public, anon, authenticated;
grant execute on function public.cancel_website_request_for_user(uuid) to service_role;

-- 9) Per-request gate for domain purchases (Aria's ruling, Oct 22 r2).
--    A domain request is tied to the customer's open website request. Buying a domain through
--    Freeplug (kind = 'need_domain') for a request that goes through the consultation step (not a
--    buyout, not an outreach claim) needs "Looks good" (agreed_at) first. Connecting a domain the
--    customer already owns ('have_domain') is not a purchase and is never blocked. Customers with no
--    open request (existing customers) are not tied, so not gated.
alter table public.domain_requests
  add column if not exists website_request_id uuid references public.website_requests (id) on delete set null;

create index if not exists domain_requests_website_request_idx
  on public.domain_requests (website_request_id) where website_request_id is not null;

create or replace function public.domain_requests_require_agreed_consultation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.website_request_id is null then
    select w.id into new.website_request_id
    from public.website_requests w
    where w.user_id = new.user_id
      and public.website_request_is_open(w.status)
    order by w.created_at desc
    limit 1;
  end if;
  if new.website_request_id is null then
    return new;
  end if;
  select w.user_id, w.status, w.is_buyout, w.source into r
  from public.website_requests w where w.id = new.website_request_id;
  if not found or r.user_id is distinct from new.user_id then
    raise exception using message = 'That website request is not yours.', errcode = '42501';
  end if;
  if new.kind = 'need_domain'
     and public.website_request_is_open(r.status)
     and coalesce(r.is_buyout, false) = false
     and r.source is distinct from 'outreach'
     and not exists (
       select 1 from public.consultations c
       where c.request_id = new.website_request_id and c.agreed_at is not null
     ) then
    raise exception using
      message = 'A domain can be bought only after the client clicks Looks good on their consultation summary.',
      errcode = 'P0001', hint = 'consultation_not_agreed';
  end if;
  return new;
end;
$$;

revoke execute on function public.domain_requests_require_agreed_consultation() from public, anon, authenticated;

drop trigger if exists domain_requests_require_agreed_consultation on public.domain_requests;
create trigger domain_requests_require_agreed_consultation
  before insert or update of kind, website_request_id on public.domain_requests
  for each row execute function public.domain_requests_require_agreed_consultation();

-- 10) Older RPCs that hard-coded "open" as ('submitted', 'in_review') now use the shared definition.
--     Bodies are copied unchanged from their latest definitions except that one predicate:
--       cancel_own_website_request    20260404100000 (service_role only since 20260924210000)
--       acknowledge_website_transfer  20260404100000 (service_role only since 20261003220000)
--       claim_outreach_site           20260927050500
--     search_path stays '' (20261013090000). create or replace keeps owners and grants.
create or replace function public.cancel_own_website_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.website_requests
  set status = 'closed', updated_at = now()
  where user_id = auth.uid()
    and public.website_request_is_open(status);
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using
      message = 'No open request to close.',
      errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.acknowledge_website_transfer()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.profiles
  set
    website_transfer_acknowledged_at = now(),
    updated_at = now()
  where id = auth.uid()
    and website_transfer_notes is not null
    and length(trim(website_transfer_notes)) > 0
    and website_value_target_cents is not null
    and website_value_target_cents > 0
    and coalesce(cumulative_website_value_paid_cents, 0) >= website_value_target_cents;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using
      message = 'Cannot confirm handoff: website value must be reached and transfer notes must be set.',
      errcode = 'P0001';
  end if;

  update public.website_requests
  set status = 'closed', updated_at = now()
  where user_id = auth.uid()
    and public.website_request_is_open(status);
end;
$$;

create or replace function public.claim_outreach_site(p_site_id uuid, p_user_id uuid)
returns table (site_id uuid, website_request_id uuid, already_claimed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.outreach_sites;
  confirmed timestamptz;
  req_id uuid;
begin
  if p_site_id is null or p_user_id is null then
    raise exception using message = 'Invalid claim.', errcode = '22023';
  end if;

  select u.email_confirmed_at into confirmed from auth.users u where u.id = p_user_id;
  if confirmed is null then
    raise exception using message = 'Confirm your email before claiming.', errcode = 'P0001', hint = 'email_unconfirmed';
  end if;

  select * into s from public.outreach_sites where id = p_site_id for update;
  if not found then
    raise exception using message = 'This preview link has expired.', errcode = 'P0001', hint = 'link_invalid';
  end if;

  if s.claimed_by is not null then
    if s.claimed_by = p_user_id then
      select w.id into req_id from public.website_requests w
      where w.user_id = p_user_id and w.outreach_site_id = p_site_id
      order by w.created_at desc limit 1;
      return query select p_site_id, req_id, true;
      return;
    end if;
    raise exception using message = 'This website was already claimed.', errcode = 'P0001', hint = 'claimed_by_other';
  end if;

  update public.outreach_sites
  set claimed_by = p_user_id, claimed_at = now(), updated_at = now()
  where id = p_site_id
    and claimed_by is null
    and revoked_at is null
    and expires_at > now();
  if not found then
    raise exception using message = 'This preview link has expired.', errcode = 'P0001', hint = 'link_invalid';
  end if;

  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;

  select w.id into req_id from public.website_requests w
  where w.user_id = p_user_id and public.website_request_is_open(w.status)
  order by w.updated_at desc limit 1
  for update;

  if req_id is null then
    insert into public.website_requests (user_id, business_name, status, source, outreach_site_id)
    values (p_user_id, s.business_name, 'submitted', 'outreach', p_site_id)
    returning id into req_id;
  else
    update public.website_requests
    set outreach_site_id = p_site_id, updated_at = now()
    where id = req_id;
  end if;

  return query select p_site_id, req_id, false;
end;
$$;
