-- Help-chat change requests (Aria spec, Oct 4 2026 2:45 PM CT; flow update ~3 PM CT).
-- Depends on 20260402120000_profiles_and_website_requests.sql (website_requests).
--
-- One row per change the customer sends from the Help chat. The chat still appends the change to
-- website_requests.notes (so /admin/requests keeps working); this table adds a status and the
-- best-effort webhook bookkeeping.
--
--   * The customer inserts their own row (RLS, with check: their own user id, their own website
--     request, status pending_review, billing unknown, plan_step / decision / notify fields null).
--     billing and plan_step are filled in by the server (service role) right after, never by the
--     customer.
--   * The customer reads their own rows, only the columns the dashboard shows (column grant):
--     never billing, plan_step, notified_at, notify_error or pr_url.
--   * No customer update or delete. The service role (admin page, webhook task) updates status,
--     the decision fields and the notify fields. Approve charges nothing and starts nothing.
--   * pr_url: optional link to the GitHub PR whose review recorded the decision (admin only).
--
-- Idempotent: IF NOT EXISTS / drop-then-add constraints / guarded policies.
-- LOCAL ONLY: not applied anywhere hosted.

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  website_request_id uuid null references public.website_requests (id) on delete set null,
  change_type text not null,
  page text not null,
  description text not null,
  photo_name text null,
  plan_step text null,
  billing text not null default 'unknown',
  status text not null default 'pending_review',
  decision_note text null,
  pr_url text null,
  decided_at timestamptz null,
  notified_at timestamptz null,
  notify_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.change_requests drop constraint if exists change_requests_change_type_check;
alter table public.change_requests add constraint change_requests_change_type_check
  check (char_length(btrim(change_type)) between 1 and 100);
alter table public.change_requests drop constraint if exists change_requests_page_check;
alter table public.change_requests add constraint change_requests_page_check
  check (char_length(btrim(page)) between 1 and 200);
alter table public.change_requests drop constraint if exists change_requests_description_check;
alter table public.change_requests add constraint change_requests_description_check
  check (char_length(btrim(description)) between 1 and 2000);
alter table public.change_requests drop constraint if exists change_requests_photo_name_check;
alter table public.change_requests add constraint change_requests_photo_name_check
  check (photo_name is null or char_length(photo_name) <= 200);
alter table public.change_requests drop constraint if exists change_requests_plan_step_check;
alter table public.change_requests add constraint change_requests_plan_step_check
  check (plan_step is null or char_length(plan_step) <= 50);
alter table public.change_requests drop constraint if exists change_requests_billing_check;
alter table public.change_requests add constraint change_requests_billing_check
  check (billing in ('included', 'paid_addon', 'quote', 'unknown'));
alter table public.change_requests drop constraint if exists change_requests_status_check;
alter table public.change_requests add constraint change_requests_status_check
  check (status in ('pending_review', 'approved', 'declined'));
alter table public.change_requests drop constraint if exists change_requests_decision_note_check;
alter table public.change_requests add constraint change_requests_decision_note_check
  check (decision_note is null or char_length(decision_note) <= 500);
alter table public.change_requests drop constraint if exists change_requests_pr_url_check;
alter table public.change_requests add constraint change_requests_pr_url_check
  check (pr_url is null or (char_length(pr_url) <= 300 and pr_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$'));
alter table public.change_requests drop constraint if exists change_requests_notify_error_check;
alter table public.change_requests add constraint change_requests_notify_error_check
  check (notify_error is null or char_length(notify_error) <= 300);
-- A decided row has a decision time; a pending one has no decision fields.
alter table public.change_requests drop constraint if exists change_requests_decision_check;
alter table public.change_requests add constraint change_requests_decision_check
  check (
    (status = 'pending_review' and decided_at is null and decision_note is null and pr_url is null)
    or (status in ('approved', 'declined') and decided_at is not null)
  );

create index if not exists change_requests_user_created_idx on public.change_requests (user_id, created_at desc);
create index if not exists change_requests_status_created_idx on public.change_requests (status, created_at);

comment on table public.change_requests is
  'Help-chat change requests: the customer inserts (pending_review); the service role records the decision (approved / declined: Ezequiel''s PR verdict) and the webhook result. Approve charges nothing and starts nothing.';
comment on column public.change_requests.billing is
  'Server classification (service role): included = a plan or add-on use is left this period; paid_addon = none left ($5 / $5.75 add-on); quote = over an hour; unknown = cannot tell.';
comment on column public.change_requests.pr_url is
  'Optional GitHub PR whose review recorded the decision. Admin only; never shown to the customer.';

alter table public.change_requests enable row level security;
alter table public.change_requests force row level security;

revoke all on table public.change_requests from public, anon, authenticated, service_role;
-- Customer: insert (RLS with check below) and read only the columns the dashboard shows.
grant insert (website_request_id, change_type, page, description, photo_name) on table public.change_requests to authenticated;
grant select (id, user_id, website_request_id, change_type, page, description, photo_name, status, decision_note, decided_at, created_at, updated_at)
  on table public.change_requests to authenticated;
-- Server: the help-chat task and the admin page. No delete.
grant select, insert, update on table public.change_requests to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'change_requests' and policyname = 'change_requests_select_own'
  ) then
    create policy change_requests_select_own on public.change_requests
      for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'change_requests' and policyname = 'change_requests_insert_own'
  ) then
    create policy change_requests_insert_own on public.change_requests
      for insert to authenticated
      with check (
        auth.uid() = user_id
        and status = 'pending_review'
        and billing = 'unknown'
        and plan_step is null
        and decision_note is null
        and pr_url is null
        and decided_at is null
        and notified_at is null
        and notify_error is null
        and (
          website_request_id is null
          or exists (
            select 1 from public.website_requests w
            where w.id = website_request_id and w.user_id = auth.uid()
          )
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'change_requests' and policyname = 'change_requests_service_role_all'
  ) then
    create policy change_requests_service_role_all on public.change_requests
      for all to service_role using (true) with check (true);
  end if;
end
$$;
