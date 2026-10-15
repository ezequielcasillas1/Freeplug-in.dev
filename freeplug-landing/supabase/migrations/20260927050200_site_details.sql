-- Site details for outreach sites (phone, address, hours, service area, quote inbox, services,
-- photos) and the pending tables the preview and the customer write to.
--
-- Rules (Vera rule 4, Aria section 6):
--   * The preview and the customer only INSERT into the pending tables below
--     (site_details_submissions, outreach_change_requests, site_photos). Rows are append-only:
--     no deletes, and the only update allowed is admin review (review_status / reviewed_at).
--   * Only admin approval (apply_site_details_submission) copies a submission into site_details.
--   * Approval refuses any preview submission older than site_details.customer_confirmed_at.
--   * The live site never reads these tables; the team applies approved changes by hand.
-- All tables are server-only (no anon / authenticated privileges; service-role guard trigger).

create table if not exists public.site_details (
  outreach_site_id uuid primary key references public.outreach_sites (id) on delete cascade,
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  services text[] not null default '{}',
  customer_confirmed_at timestamptz,
  applied_submission_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.site_details enable row level security;
revoke all on table public.site_details from public, anon, authenticated;
grant select, insert, update on table public.site_details to service_role;

drop trigger if exists site_details_guard on public.site_details;
create trigger site_details_guard
  before insert or update or delete on public.site_details
  for each row execute function public.outreach_guard_service_role_only();

create table if not exists public.site_details_submissions (
  id uuid primary key default gen_random_uuid(),
  outreach_site_id uuid not null references public.outreach_sites (id) on delete cascade,
  source text not null check (source in ('preview', 'customer', 'admin')),
  submitted_by uuid references auth.users (id) on delete set null,
  -- {"phone": "...", "address": "...", "hours": "...", "service_area": "...", "quote_email": "..."}
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  -- [{"name": "Lawn mowing", "keep": true}, ...]
  services jsonb not null default '[]'::jsonb check (jsonb_typeof(services) = 'array'),
  submitted_at timestamptz not null default now(),
  -- 'superseded': an old preview row closed automatically once the customer's confirmed details
  -- (which carried its photos) were applied or rejected (Vera r3 NEW-1/NEW-2).
  review_status text not null default 'pending' check (review_status in ('pending', 'applied', 'rejected', 'superseded')),
  reviewed_at timestamptz
);

create index if not exists site_details_submissions_site_idx
  on public.site_details_submissions (outreach_site_id, submitted_at desc);

alter table public.site_details_submissions enable row level security;
revoke all on table public.site_details_submissions from public, anon, authenticated;
grant select, insert, update on table public.site_details_submissions to service_role;

-- Append-only with one exception: admin review may move a pending row to applied / rejected.
create or replace function public.outreach_review_only_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Only the 90-day photo cleanup (purge_site_photos) may delete, and only site_photos rows.
    if tg_table_name = 'site_photos' and current_setting('freeplug.photo_cleanup', true) = 'on' then
      return old;
    end if;
    raise exception using message = tg_table_name || ' is append-only.', errcode = '42501';
  end if;
  -- site_photos.file_deleted_at: set once, only on an approved photo, when the admin deletes
  -- Freeplug's stored copy after adding the photo to the site (the row stays for the count/audit).
  if tg_table_name = 'site_photos'
     and (to_jsonb(new) ->> 'file_deleted_at') is distinct from (to_jsonb(old) ->> 'file_deleted_at') then
    if (to_jsonb(old) ->> 'file_deleted_at') is not null or (to_jsonb(new) ->> 'file_deleted_at') is null
       or old.review_status <> 'applied' or new.review_status <> 'applied' then
      raise exception using message = 'Only an approved photo''s stored copy can be deleted, once.', errcode = '42501';
    end if;
  end if;
  if (to_jsonb(new) - 'review_status' - 'reviewed_at' - 'file_deleted_at') is distinct from
     (to_jsonb(old) - 'review_status' - 'reviewed_at' - 'file_deleted_at') then
    raise exception using message = tg_table_name || ' is append-only.', errcode = '42501';
  end if;
  if old.review_status <> 'pending' and new.review_status is distinct from old.review_status then
    raise exception using message = 'This item was already reviewed.', errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.outreach_review_only_update() from public, anon, authenticated;

drop trigger if exists site_details_submissions_guard on public.site_details_submissions;
create trigger site_details_submissions_guard
  before insert or update or delete on public.site_details_submissions
  for each row execute function public.outreach_guard_service_role_only();

drop trigger if exists site_details_submissions_review_only on public.site_details_submissions;
create trigger site_details_submissions_review_only
  before update or delete on public.site_details_submissions
  for each row execute function public.outreach_review_only_update();

create table if not exists public.outreach_change_requests (
  id uuid primary key default gen_random_uuid(),
  outreach_site_id uuid not null references public.outreach_sites (id) on delete cascade,
  source text not null check (source in ('preview', 'customer')),
  change_type text not null check (length(change_type) between 1 and 100),
  description text not null check (length(description) between 1 and 2000),
  created_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'applied', 'rejected')),
  reviewed_at timestamptz
);

create index if not exists outreach_change_requests_site_idx
  on public.outreach_change_requests (outreach_site_id, created_at desc);

alter table public.outreach_change_requests enable row level security;
revoke all on table public.outreach_change_requests from public, anon, authenticated;
grant select, insert, update on table public.outreach_change_requests to service_role;

drop trigger if exists outreach_change_requests_guard on public.outreach_change_requests;
create trigger outreach_change_requests_guard
  before insert or update or delete on public.outreach_change_requests
  for each row execute function public.outreach_guard_service_role_only();

drop trigger if exists outreach_change_requests_review_only on public.outreach_change_requests;
create trigger outreach_change_requests_review_only
  before update or delete on public.outreach_change_requests
  for each row execute function public.outreach_review_only_update();

-- Photos (re-encoded JPEGs in the private "outreach" bucket, random file names). Outreach photos
-- (preview / claimed customer) belong to one pending submission, so each photo uploads (and can
-- be retried) on its own after the details were sent. Organic customers' photos belong to the user.
create table if not exists public.site_photos (
  id uuid primary key default gen_random_uuid(),
  outreach_site_id uuid references public.outreach_sites (id) on delete cascade,
  submission_id uuid references public.site_details_submissions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  -- Idempotency key from the browser (one UUID per picked photo): a retried upload of the same
  -- photo finds this row instead of adding a second one, so it counts toward the cap once.
  client_photo_id uuid,
  source text not null check (source in ('preview', 'customer', 'admin')),
  storage_path text not null unique check (storage_path ~ '^(outreach|users)/[0-9a-f-]{36}/photos/[0-9a-f]{32}\.jpg$'),
  bytes integer not null check (bytes > 0 and bytes <= 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'applied', 'rejected')),
  reviewed_at timestamptz,
  -- Set when the admin deleted Freeplug's stored copy of an approved photo (file removed from
  -- Storage; the row stays so the preview link's lifetime count doesn't go down).
  file_deleted_at timestamptz,
  check (outreach_site_id is not null or user_id is not null),
  check (source = 'admin' or outreach_site_id is null or submission_id is not null),
  check (source = 'admin' or client_photo_id is not null)
);

alter table public.site_photos add column if not exists file_deleted_at timestamptz;

create index if not exists site_photos_site_idx on public.site_photos (outreach_site_id) where outreach_site_id is not null;
create index if not exists site_photos_submission_idx on public.site_photos (submission_id) where submission_id is not null;
create unique index if not exists site_photos_site_client_uidx
  on public.site_photos (outreach_site_id, client_photo_id) where outreach_site_id is not null and client_photo_id is not null;
create unique index if not exists site_photos_user_client_uidx
  on public.site_photos (user_id, client_photo_id) where outreach_site_id is null and client_photo_id is not null;
create index if not exists site_photos_user_idx on public.site_photos (user_id) where user_id is not null;

alter table public.site_photos enable row level security;
revoke all on table public.site_photos from public, anon, authenticated;
grant select, insert, update on table public.site_photos to service_role;

drop trigger if exists site_photos_guard on public.site_photos;
create trigger site_photos_guard
  before insert or update or delete on public.site_photos
  for each row execute function public.outreach_guard_service_role_only();

drop trigger if exists site_photos_review_only on public.site_photos;
create trigger site_photos_review_only
  before update or delete on public.site_photos
  for each row execute function public.outreach_review_only_update();

-- Preview photos carried into the customer's claim step 2 submission (Sep 27, round 3). Photos
-- sent from the preview stay on their preview submission (append-only, still shown there for
-- reference), and confirm_customer_details links every still-pending one to the customer's step 2
-- submission. Approving goes through that customer submission: apply/reject on a preview
-- submission never touches a carried photo, and a photo is carried into at most one submission
-- (unique photo_id), so it can only be approved once. Written only by confirm_customer_details.
create table if not exists public.site_submission_carried_photos (
  submission_id uuid not null references public.site_details_submissions (id) on delete cascade,
  photo_id uuid not null references public.site_photos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (submission_id, photo_id),
  unique (photo_id)
);

alter table public.site_submission_carried_photos enable row level security;
revoke all on table public.site_submission_carried_photos from public, anon, authenticated, service_role;
grant select on table public.site_submission_carried_photos to service_role;

-- Caps (must match PHOTO_LIMITS in src/lib/outreach/limits.ts; limits.test.ts checks them):
--   * cap_preview_link: anonymous preview link, lifetime, counted across ALL its submissions
--     (every photo ever sent from the link, whatever its review status).
--   * cap_customer_request: signed-in claimed customer, per upload request (= per submission,
--     counting the preview photos carried into it, like the step 2 counter), no lifetime cap
--     (Jace, Sep 27 12:40 AM); the server also rate limits per account.
--   * cap_organic_account: organic customers (no outreach site), lifetime per account.
-- A retry of the same photo reuses its row (client_photo_id), so it never counts twice.
-- Outreach photos only attach to a pending submission of the same site and source.
create or replace function public.site_photos_enforce_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cap_preview_link constant integer := 50;      -- PHOTO_LIMITS.maxPerLink
  cap_customer_request constant integer := 50;  -- PHOTO_LIMITS.maxPerCustomerRequest
  cap_organic_account constant integer := 50;   -- PHOTO_LIMITS.maxPerOrganicAccount
  n integer;
  cap integer;
  sub public.site_details_submissions;
begin
  if new.source = 'admin' then
    return new;
  end if;
  if new.outreach_site_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('site_photos:site:' || new.outreach_site_id::text, 0));
    select * into sub from public.site_details_submissions where id = new.submission_id;
    if not found or sub.outreach_site_id is distinct from new.outreach_site_id
       or sub.review_status <> 'pending' or sub.source <> new.source then
      raise exception using message = 'That submission is closed.', errcode = 'P0001', hint = 'submission_closed';
    end if;
    if new.source = 'preview' then
      select count(*) into n from public.site_photos
      where outreach_site_id = new.outreach_site_id and source = 'preview';
      cap := cap_preview_link;
    else
      select (select count(*) from public.site_photos where submission_id = new.submission_id)
           + (select count(*) from public.site_submission_carried_photos where submission_id = new.submission_id)
        into n;
      cap := cap_customer_request;
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('site_photos:user:' || new.user_id::text, 0));
    select count(*) into n from public.site_photos
    where outreach_site_id is null and user_id = new.user_id and source <> 'admin';
    cap := cap_organic_account;
  end if;
  if n >= cap then
    raise exception using message = format('Photo limit reached (%s).', cap), errcode = 'P0001', hint = 'photo_limit';
  end if;
  return new;
end;
$$;

revoke execute on function public.site_photos_enforce_cap() from public, anon, authenticated;

drop trigger if exists site_photos_cap on public.site_photos;
create trigger site_photos_cap
  before insert on public.site_photos
  for each row execute function public.site_photos_enforce_cap();

-- The photos a review of submission p_submission_id acts on: its own photos that were not carried
-- into another submission, plus the photos carried into it.
create or replace function public.submission_review_photo_ids(p_submission_id uuid)
returns table (photo_id uuid)
language sql
stable
set search_path = public
as $$
  select p.id from public.site_photos p
  where p.submission_id = p_submission_id
    and not exists (select 1 from public.site_submission_carried_photos c
                    where c.photo_id = p.id and c.submission_id <> p_submission_id)
  union
  select c.photo_id from public.site_submission_carried_photos c where c.submission_id = p_submission_id;
$$;

revoke execute on function public.submission_review_photo_ids(uuid) from public, anon, authenticated;
grant execute on function public.submission_review_photo_ids(uuid) to service_role;

-- Claim step 2 "Confirm details", in one transaction: the customer's append-only submission, the
-- still-pending preview photos carried into it, and site_details.customer_confirmed_at. Only for
-- the user who claimed the site (the server passes the verified session user id).
create or replace function public.confirm_customer_details(p_site_id uuid, p_user_id uuid, p_fields jsonb, p_services jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  ts timestamptz := now();
begin
  perform 1 from public.outreach_sites where id = p_site_id and claimed_by = p_user_id for update;
  if not found then
    raise exception using message = 'This site is not claimed by this account.', errcode = '42501', hint = 'no_site';
  end if;
  insert into public.site_details_submissions (outreach_site_id, source, submitted_by, fields, services, submitted_at)
  values (p_site_id, 'customer', p_user_id, p_fields, p_services, ts)
  returning id into sid;
  insert into public.site_submission_carried_photos (submission_id, photo_id)
  select sid, p.id
  from public.site_photos p
  where p.outreach_site_id = p_site_id and p.source = 'preview' and p.review_status = 'pending'
    and p.file_deleted_at is null
    and not exists (select 1 from public.site_submission_carried_photos c where c.photo_id = p.id);
  insert into public.site_details (outreach_site_id, customer_confirmed_at, updated_at)
  values (p_site_id, ts, ts)
  on conflict (outreach_site_id) do update
    set customer_confirmed_at = excluded.customer_confirmed_at, updated_at = excluded.updated_at;
  return sid;
end;
$$;

revoke execute on function public.confirm_customer_details(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_customer_details(uuid, uuid, jsonb, jsonb) to service_role;

-- Once the customer's confirmed details are applied or rejected, the older preview rows whose
-- photos were carried into them have nothing left to review: close them as 'superseded' so they
-- stop pointing at a row that is gone and the "Details to review" badge clears (Vera r3 NEW-1,
-- NEW-2). A preview row that still has a pending photo of its own stays open.
create or replace function public.close_superseded_preview_submissions(p_customer_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.site_details_submissions;
  n integer;
begin
  select * into c from public.site_details_submissions where id = p_customer_submission_id;
  if not found or c.source <> 'customer' then
    return 0;
  end if;
  update public.site_details_submissions ps
  set review_status = 'superseded', reviewed_at = now()
  where ps.outreach_site_id = c.outreach_site_id
    and ps.source = 'preview'
    and ps.review_status = 'pending'
    and ps.submitted_at < c.submitted_at
    and not exists (
      select 1 from public.site_photos p
      where p.review_status = 'pending'
        and p.id in (select photo_id from public.submission_review_photo_ids(ps.id))
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.close_superseded_preview_submissions(uuid) from public, anon, authenticated;

-- Admin "Reject": the submission and the photos it reviews (see submission_review_photo_ids), so
-- rejecting a stale preview submission leaves its carried photos pending on the customer's row.
-- Rejecting the customer's row also rejects the photos carried into it (the admin screen asks
-- first) and closes the old preview rows. An already-reviewed submission is refused with a clear
-- message (Vera r3 note: it used to return ok and change nothing).
create or replace function public.reject_site_details_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select review_status into st from public.site_details_submissions where id = p_submission_id for update;
  if not found then
    raise exception using message = 'Submission not found.', errcode = 'P0002';
  end if;
  if st = 'applied' then
    -- Sable 1:34 AM.
    raise exception using message = 'These details were already applied, so they can''t be rejected.', errcode = 'P0001', hint = 'already_applied';
  end if;
  if st <> 'pending' then
    raise exception using message = 'This submission was already reviewed.', errcode = 'P0001', hint = 'already_reviewed';
  end if;
  update public.site_details_submissions
  set review_status = 'rejected', reviewed_at = now()
  where id = p_submission_id;
  update public.site_photos p
  set review_status = 'rejected', reviewed_at = now()
  where p.review_status = 'pending'
    and p.id in (select photo_id from public.submission_review_photo_ids(p_submission_id));
  perform public.close_superseded_preview_submissions(p_submission_id);
end;
$$;

revoke execute on function public.reject_site_details_submission(uuid) from public, anon, authenticated;
grant execute on function public.reject_site_details_submission(uuid) to service_role;

-- Admin approval: copy a pending submission into site_details. Refuses stale preview submissions.
create or replace function public.apply_site_details_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.site_details_submissions;
  d public.site_details;
  base text[];
  removed text[];
  merged text[];
begin
  select * into s from public.site_details_submissions where id = p_submission_id for update;
  if not found then
    raise exception using message = 'Submission not found.', errcode = 'P0002';
  end if;
  if s.review_status <> 'pending' then
    raise exception using message = 'This submission was already reviewed.', errcode = 'P0001', hint = 'already_reviewed';
  end if;

  insert into public.site_details (outreach_site_id) values (s.outreach_site_id)
  on conflict (outreach_site_id) do nothing;
  select * into d from public.site_details where outreach_site_id = s.outreach_site_id for update;

  if s.source = 'preview' and d.customer_confirmed_at is not null
     and s.submitted_at < d.customer_confirmed_at then
    raise exception using
      message = 'This preview submission is older than the customer''s confirmed details.',
      errcode = 'P0001', hint = 'stale_submission';
  end if;

  -- Services MERGE (Vera QA #2, Sep 27): the submission only lists the services the person
  -- answered. Unanswered and Keep stay, only Remove (keep = false) removes, and a kept name that
  -- isn't on the list yet (an added service) is appended in the order sent. The starting list is
  -- the approved one, or the site's own list before anything was approved.
  if d.applied_submission_id is null then
    select coalesce(o.services, '{}') into base from public.outreach_sites o where o.id = s.outreach_site_id;
  else
    base := d.services;
  end if;
  select coalesce(array_agg(x ->> 'name'), '{}') into removed
  from jsonb_array_elements(s.services) as t(x)
  where (x ->> 'keep')::boolean is false;
  select coalesce(array_agg(b order by ord), '{}') into merged
  from unnest(base) with ordinality as u(b, ord)
  where not (b = any (removed));
  select merged || coalesce(array_agg(n order by ord), '{}') into merged
  from (
    select distinct on (x ->> 'name') x ->> 'name' as n, ord
    from jsonb_array_elements(s.services) with ordinality as t(x, ord)
    where coalesce((x ->> 'keep')::boolean, false) and length(coalesce(x ->> 'name', '')) > 0
    order by x ->> 'name', ord
  ) added
  where not (n = any (merged));

  update public.site_details
  set fields = d.fields || (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                             from jsonb_each(s.fields) as e(k, v)
                             where jsonb_typeof(v) = 'string' and length(v #>> '{}') > 0),
      services = merged,
      applied_submission_id = s.id,
      updated_at = now()
  where outreach_site_id = s.outreach_site_id;

  update public.site_details_submissions
  set review_status = 'applied', reviewed_at = now()
  where id = s.id;

  -- This submission's own photos (minus any carried into a customer submission, which are
  -- approved there) plus the preview photos carried into it. Only pending photos change, so no
  -- photo is ever approved twice.
  update public.site_photos p
  set review_status = 'applied', reviewed_at = now()
  where p.review_status = 'pending'
    and p.id in (select photo_id from public.submission_review_photo_ids(s.id));

  perform public.close_superseded_preview_submissions(s.id);
end;
$$;

revoke execute on function public.apply_site_details_submission(uuid) from public, anon, authenticated;
grant execute on function public.apply_site_details_submission(uuid) to service_role;

-- 90-day cleanup of photos sent from previews that were never claimed. The server first removes
-- the files from Storage (Storage API), then calls this to delete the rows. Refuses rows that
-- are not preview photos of an unclaimed site older than the cutoff. Admin-triggered today;
-- ready for a scheduler (pg_cron / Netlify scheduled function) later.
create or replace function public.purge_site_photos(p_photo_ids uuid[], p_older_than interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  perform set_config('freeplug.photo_cleanup', 'on', true);
  delete from public.site_photos p
  using public.outreach_sites s
  where p.id = any (p_photo_ids)
    and s.id = p.outreach_site_id
    and p.source = 'preview'
    and s.claimed_by is null
    and p.created_at < now() - p_older_than;
  get diagnostics n = row_count;
  perform set_config('freeplug.photo_cleanup', 'off', true);
  return n;
end;
$$;

revoke execute on function public.purge_site_photos(uuid[], interval) from public, anon, authenticated;
grant execute on function public.purge_site_photos(uuid[], interval) to service_role;
