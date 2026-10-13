-- set: 20260927050800-r12 (use only with the other files in this set)
-- One pending customer details submission per outreach site (Jace, Sep 27, round 9).
--
-- Claim step 2 "Confirm details" used to append a new 'customer' row on every confirm, so
-- confirming twice left two pending rows for the admin. Now:
--   * At most ONE pending customer details row per site: partial unique index on
--     site_details_submissions (outreach_site_id) where source = 'customer' and
--     review_status = 'pending' and fields <> '{}'. Two confirms at the same moment can't both insert.
--   * confirm_customer_details updates that pending row in place (fields, services, submitted_at)
--     and keeps its id, so photos already attached to it (own photos and carried preview photos)
--     stay with it. Applied, rejected and superseded rows are never modified: once the pending row
--     has been reviewed, the next confirm starts a new row.
--   * Race: if the insert still hits the unique index (another confirm won), it retries as an
--     update of the row that won.
--
-- Scope: dashboard "Upload photos" batches are also 'customer' rows, but photos-only (fields = {}),
-- and each batch is its own upload request with its own 50-photo cap (Jace, 12:40 AM). They are
-- NOT covered by the index and keep working as before. Step 2 always sends fields (phone, hours,
-- service area and quote inbox are required), and confirm_customer_details now refuses empty ones.
--
-- Existing duplicates (safe, idempotent): if a site already has more than one pending customer
-- details row, the newest (submitted_at, then id) is kept and the older ones are marked
-- 'superseded' (reviewed_at = now()), the same closed state old preview rows get. Nothing is
-- deleted and no fields change.
--
-- Photos on the closed rows (round 12, Jace): photos that are STILL PENDING move onto the kept
-- row, so the admin can review them there (a superseded customer row has no review buttons).
-- Approved and rejected photos stay on their original row. Own photos move by
-- site_photos.submission_id, carried preview photos by site_submission_carried_photos.submission_id;
-- nothing else changes (created_at, storage_path and the stored file stay as they are, so the
-- order is kept and nothing is copied). The kept row's 50-photo request cap (own + carried, same
-- count as site_photos_enforce_cap) is respected: oldest photos move first and any extra stays on
-- the closed row and is listed in the NOTICE. Every move is recorded in public.outreach_photo_moves
-- (admin only). Rerunning moves nothing and logs nothing: nothing pending is left to move, and
-- the kept row's count never goes down (photos are append-only). The local-only undo snippet
-- (undo-photo-moves.sql in the same hosted set) restores each photo from this log.
--
-- Round 12: this migration was never applied to the hosted database; it was edited in place
-- (photo move + audit table). precheck.sql of the same set (read only) shows beforehand how
-- many rows would be closed and how many photos would move; photos_to_move equals the number of
-- log rows the migration writes.
--
-- Needs Ezequiel's approval before it is applied to the hosted database.

-- 1. Review-only trigger: same rules as before, plus the one in-place edit confirm_customer_details
--    makes (flag freeplug.confirm_update, set only inside that function): a pending customer
--    details row may get new fields, services and submitted_at, and nothing else. Round 12: and the
--    photo move below (flag freeplug.photo_move, set only inside this migration and the local undo
--    snippet): a PENDING customer photo may change submission_id, and nothing else, between two
--    customer details rows of its own site.
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
  -- Step 2 re-confirm (round 9): update the pending customer details row in place.
  if tg_table_name = 'site_details_submissions'
     and current_setting('freeplug.confirm_update', true) = 'on'
     and (to_jsonb(old) ->> 'source') = 'customer'
     and (to_jsonb(old) ->> 'review_status') = 'pending'
     and (to_jsonb(new) ->> 'review_status') = 'pending'
     and (to_jsonb(old) ->> 'fields') <> '{}' then
    if (to_jsonb(new) - 'fields' - 'services' - 'submitted_at') is distinct from
       (to_jsonb(old) - 'fields' - 'services' - 'submitted_at') then
      raise exception using message = tg_table_name || ' is append-only.', errcode = '42501';
    end if;
    return new;
  end if;
  -- Round 12 photo move (migration 20260927050800 / its local undo): only submission_id changes.
  if tg_table_name = 'site_photos' and current_setting('freeplug.photo_move', true) = 'on' then
    if old.review_status <> 'pending' or new.review_status <> 'pending' or old.source <> 'customer'
       or (to_jsonb(new) - 'submission_id') is distinct from (to_jsonb(old) - 'submission_id')
       or (select count(*) from public.site_details_submissions s
           where s.id in (old.submission_id, new.submission_id) and s.outreach_site_id = old.outreach_site_id
             and s.source = 'customer' and s.fields <> '{}'::jsonb) <> 2 then
      raise exception using message = 'Only a pending photo can move, between customer details rows of its own site.', errcode = '42501';
    end if;
    return new;
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

-- 2. Audit log of the photo moves (round 12, Jace). Admin only: RLS on and no policies, the
--    customer roles get nothing, the service role (admin pages) may only read, same pattern as
--    site_submission_carried_photos. Written only by this migration (as the owner). A photo is
--    logged at most once per migration (unique), so a rerun can't add duplicate rows.
create table if not exists public.outreach_photo_moves (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.site_photos (id) on delete cascade,
  from_submission_id uuid not null references public.site_details_submissions (id) on delete cascade,
  to_submission_id uuid not null references public.site_details_submissions (id) on delete cascade,
  -- 'own': site_photos.submission_id moved; 'carried': site_submission_carried_photos.submission_id moved.
  link text not null check (link in ('own', 'carried')),
  moved_at timestamptz not null default now(),
  migration text not null default '20260927050800',
  unique (photo_id, migration),
  check (from_submission_id <> to_submission_id)
);

alter table public.outreach_photo_moves enable row level security;
revoke all on table public.outreach_photo_moves from public, anon, authenticated, service_role;
grant select on table public.outreach_photo_moves to service_role;

-- 3. Close older duplicate pending customer details rows (keep the newest per site).
do $$
declare
  closed uuid[];
  photos integer;
begin
  with ranked as (
    select id, row_number() over (partition by outreach_site_id order by submitted_at desc, id desc) as rn
    from public.site_details_submissions
    where source = 'customer' and review_status = 'pending' and fields <> '{}'::jsonb
  ), upd as (
    update public.site_details_submissions s
    set review_status = 'superseded', reviewed_at = now()
    from ranked r
    where s.id = r.id and r.rn > 1
    returning s.id
  )
  select coalesce(array_agg(id), '{}') into closed from upd;
  if cardinality(closed) > 0 then
    select count(*) into photos
    from unnest(closed) as c(id)
    cross join lateral public.submission_review_photo_ids(c.id) as p(photo_id)
    join public.site_photos sp on sp.id = p.photo_id and sp.review_status = 'pending';
    raise notice 'one_pending_customer_details: closed % older duplicate pending customer row(s) as superseded (ids: %); they held % pending photo(s), moved in step 4 (up to the kept row''s cap).',
      cardinality(closed), closed, photos;
  end if;
end $$;

-- 4. Move still-pending photos off closed (superseded) customer details rows onto the site's one
--    pending customer details row. Approved/rejected photos never move. Oldest first, up to the
--    kept row's 50-photo cap (PHOTO_LIMITS.maxPerCustomerRequest). One log row per move.
do $$
declare
  cap_customer_request constant integer := 50;  -- PHOTO_LIMITS.maxPerCustomerRequest
  k record;
  p record;
  room integer;
  moved integer;
  total integer := 0;
  extra uuid[];
begin
  perform set_config('freeplug.photo_move', 'on', true);
  for k in
    select s.id, s.outreach_site_id
    from public.site_details_submissions s
    where s.source = 'customer' and s.review_status = 'pending' and s.fields <> '{}'::jsonb
      and exists (select 1 from public.site_details_submissions o
                  where o.outreach_site_id = s.outreach_site_id and o.source = 'customer'
                    and o.review_status = 'superseded' and o.fields <> '{}'::jsonb)
    order by s.outreach_site_id
  loop
    select cap_customer_request
           - (select count(*) from public.site_photos where submission_id = k.id)
           - (select count(*) from public.site_submission_carried_photos where submission_id = k.id)
      into room;
    moved := 0;
    extra := '{}';
    for p in
      select sp.id as photo_id, o.id as from_id,
             case when c.photo_id is not null then 'carried' else 'own' end as link
      from public.site_details_submissions o
      cross join lateral public.submission_review_photo_ids(o.id) as r(photo_id)
      join public.site_photos sp on sp.id = r.photo_id and sp.review_status = 'pending'
      left join public.site_submission_carried_photos c on c.photo_id = sp.id and c.submission_id = o.id
      where o.outreach_site_id = k.outreach_site_id and o.source = 'customer'
        and o.review_status = 'superseded' and o.fields <> '{}'::jsonb
      order by sp.created_at, sp.id
    loop
      if moved >= room then
        extra := extra || p.photo_id;
        continue;
      end if;
      if p.link = 'carried' then
        update public.site_submission_carried_photos set submission_id = k.id
        where photo_id = p.photo_id and submission_id = p.from_id;
      else
        update public.site_photos set submission_id = k.id
        where id = p.photo_id and submission_id = p.from_id and review_status = 'pending';
      end if;
      insert into public.outreach_photo_moves (photo_id, from_submission_id, to_submission_id, link)
      values (p.photo_id, p.from_id, k.id, p.link);
      moved := moved + 1;
    end loop;
    total := total + moved;
    if moved > 0 or cardinality(extra) > 0 then
      raise notice 'one_pending_customer_details: site % moved % pending photo(s) onto %; % over the 50-photo cap stay on the closed row (ids: %).',
        k.outreach_site_id, moved, k.id, cardinality(extra), extra;
    end if;
  end loop;
  perform set_config('freeplug.photo_move', 'off', true);
  if total > 0 then
    raise notice 'one_pending_customer_details: moved % pending photo(s) in total (logged in public.outreach_photo_moves).', total;
  end if;
end $$;

-- 5. At most one pending customer details row per site.
create unique index if not exists site_details_submissions_one_pending_customer_uidx
  on public.site_details_submissions (outreach_site_id)
  where source = 'customer' and review_status = 'pending' and fields <> '{}'::jsonb;

-- 6. Claim step 2 "Confirm details": one pending customer details row, updated in place.
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
  -- Locks the site row, so confirms for the same site run one at a time.
  perform 1 from public.outreach_sites where id = p_site_id and claimed_by = p_user_id for update;
  if not found then
    raise exception using message = 'This site is not claimed by this account.', errcode = '42501', hint = 'no_site';
  end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' or p_fields = '{}'::jsonb then
    raise exception using message = 'Details are empty.', errcode = '22023', hint = 'invalid';
  end if;

  select id into sid from public.site_details_submissions
  where outreach_site_id = p_site_id and source = 'customer' and review_status = 'pending' and fields <> '{}'::jsonb
  for update;
  if sid is null then
    begin
      insert into public.site_details_submissions (outreach_site_id, source, submitted_by, fields, services, submitted_at)
      values (p_site_id, 'customer', p_user_id, p_fields, p_services, ts)
      returning id into sid;
    exception when unique_violation then
      -- Another confirm inserted the pending row first: update that row instead.
      select id into sid from public.site_details_submissions
      where outreach_site_id = p_site_id and source = 'customer' and review_status = 'pending' and fields <> '{}'::jsonb
      for update;
    end;
  end if;

  if exists (select 1 from public.site_details_submissions where id = sid and submitted_at <> ts) then
    perform set_config('freeplug.confirm_update', 'on', true);
    update public.site_details_submissions
    set fields = p_fields, services = p_services, submitted_at = ts
    where id = sid and review_status = 'pending';
    perform set_config('freeplug.confirm_update', 'off', true);
  end if;

  -- Preview photos still waiting for review that were never carried: carry them into this row.
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
