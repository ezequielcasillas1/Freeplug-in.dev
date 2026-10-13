-- Change-request caps (Aria ruling 8, Oct 4 2026 3:51 PM CT). Depends on 20261004150000_change_requests.sql.
--
--   * At most 10 pending_review change requests per user, and at most 20 per user in any rolling
--     24 hours (any status). Enforced by a BEFORE INSERT trigger, so a customer posting straight
--     to PostgREST hits the same caps as the Help chat. The app maps the errors to friendly lines.
--   * description length matches the Help chat form: the textarea's maxLength=2000 counts the raw
--     text, and the form needs something besides spaces. Stored byte for byte (never trimmed or
--     scrubbed); only the webhook payload is scrubbed.
--
-- Error contract (SQLSTATE P0001, message is the token): change_requests_pending_cap,
-- change_requests_daily_cap. Constraint name for length: change_requests_description_check.
-- Idempotent. LOCAL ONLY: launch guard (HOSTING-LADDER-NOTES.md), not on r13 / preview / hosted
-- until Aria's go.

alter table public.change_requests drop constraint if exists change_requests_description_check;
alter table public.change_requests add constraint change_requests_description_check
  check (char_length(description) between 1 and 2000 and char_length(btrim(description)) >= 1);

create or replace function public.change_requests_enforce_caps()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pending_count integer;
  day_count integer;
begin
  -- One insert at a time per user, so two parallel posts can't both slip under a cap.
  perform pg_advisory_xact_lock(hashtextextended('change_requests_caps:' || new.user_id::text, 0));

  select count(*) into pending_count
    from public.change_requests
   where user_id = new.user_id and status = 'pending_review';
  if pending_count >= 10 then
    raise exception 'change_requests_pending_cap'
      using errcode = 'P0001', hint = 'At most 10 change requests can wait for review at once.';
  end if;

  select count(*) into day_count
    from public.change_requests
   where user_id = new.user_id and created_at > now() - interval '24 hours';
  if day_count >= 20 then
    raise exception 'change_requests_daily_cap'
      using errcode = 'P0001', hint = 'At most 20 change requests in 24 hours.';
  end if;

  return new;
end
$$;

revoke all on function public.change_requests_enforce_caps() from public, anon, authenticated;

drop trigger if exists change_requests_enforce_caps on public.change_requests;
create trigger change_requests_enforce_caps
  before insert on public.change_requests
  for each row execute function public.change_requests_enforce_caps();

comment on function public.change_requests_enforce_caps() is
  'Aria ruling 8: 10 pending_review per user, 20 per rolling 24h per user. Raises change_requests_pending_cap / change_requests_daily_cap (P0001).';
