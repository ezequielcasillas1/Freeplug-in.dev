-- Webhook email ledger (Aria, Oct 3 2026).
--
-- Stops a webhook-driven email (today: the Stripe cancellation notice) going out twice when Stripe
-- redelivers an event after Resend's 24 h idempotency window, or when two deliveries arrive at once.
-- One row per (stripe_event_id, template). No recipient or other personal data is stored.
--
-- Claim protocol (src/lib/email/webhook-email-ledger.ts):
--   1. email_send_claim(): INSERT ... ON CONFLICT (stripe_event_id, template) DO NOTHING RETURNING id.
--      If nothing is returned, one conditional UPDATE re-claims the row only when it is 'failed', or
--      'pending' with updated_at older than 15 minutes (a crash after the claim), bumping attempts.
--      Zero rows back = someone else has it (or it was sent): skip the send.
--   2. After the send, email_send_finish() marks the row 'sent' (with the Resend id) or 'failed'
--      (short, PII-free error).
-- Both run as the caller (service_role). Only the 30-day prune is SECURITY DEFINER.
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / guarded policies; re-running changes nothing.

create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null check (length(stripe_event_id) between 1 and 255),
  template text not null check (length(template) between 1 and 64),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  resend_id text null check (resend_id is null or length(resend_id) <= 128),
  attempts integer not null default 1 check (attempts >= 1),
  last_error text null check (last_error is null or length(last_error) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_sends_stripe_event_id_template_key unique (stripe_event_id, template)
);

create index if not exists email_sends_created_at_idx on public.email_sends (created_at);

comment on table public.email_sends is
  'Webhook email ledger: one row per (Stripe event, template). No recipient or personal data. Pruned after 30 days.';

-- RLS on and forced; no policies for anon or authenticated, so they can never see or write a row.
alter table public.email_sends enable row level security;
alter table public.email_sends force row level security;

-- Privileges: nothing for PUBLIC / anon / authenticated (this also undoes Supabase's default
-- "grant all on tables" in public). service_role gets only what the claim and finish need:
-- SELECT (for RETURNING and the WHERE), INSERT and UPDATE. No DELETE: only the prune deletes.
revoke all on table public.email_sends from public, anon, authenticated, service_role;
grant select, insert, update on table public.email_sends to service_role;

-- Policies (guarded so a re-run is a no-op):
--  * service_role: has BYPASSRLS on Supabase; this policy keeps the ledger working even if it didn't.
--  * the owner (the role running this migration): FORCE applies RLS to the owner too, so the
--    SECURITY DEFINER prune gets a delete policy limited to rows older than 30 days.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_sends' and policyname = 'email_sends_service_role_all'
  ) then
    create policy email_sends_service_role_all on public.email_sends
      for all to service_role using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_sends' and policyname = 'email_sends_owner_prune'
  ) then
    create policy email_sends_owner_prune on public.email_sends
      for delete to current_user using (created_at < now() - interval '30 days');
  end if;
  -- The prune's DELETE ... WHERE needs to read the rows it deletes.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_sends' and policyname = 'email_sends_owner_prune_select'
  ) then
    create policy email_sends_owner_prune_select on public.email_sends
      for select to current_user using (created_at < now() - interval '30 days');
  end if;
end
$$;

-- 30-day prune (same style as rate_check()'s occasional cleanup; the repo has no pg_cron). Called
-- now and then from email_send_claim(); can also be called by the service role.
create or replace function public.prune_email_sends()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.email_sends where created_at < pg_catalog.now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.prune_email_sends() from public, anon, authenticated;
grant execute on function public.prune_email_sends() to service_role;

-- Claim a (Stripe event, template) send. Returns one row (id, attempts) when the caller may send,
-- zero rows when it must skip.
create or replace function public.email_send_claim(p_stripe_event_id text, p_template text)
returns table (id uuid, attempts integer)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_stripe_event_id is null or p_template is null
     or length(p_stripe_event_id) = 0 or length(p_template) = 0 then
    raise exception using message = 'email_send_claim: invalid arguments', errcode = '22023';
  end if;

  return query
    insert into public.email_sends as e (stripe_event_id, template, status)
    values (p_stripe_event_id, p_template, 'pending')
    on conflict (stripe_event_id, template) do nothing
    returning e.id, e.attempts;

  if found then
    if pg_catalog.random() < 0.01 then
      perform public.prune_email_sends();
    end if;
    return;
  end if;

  -- Re-claim only a failed send or a stale pending one (crash after the claim). One statement, so
  -- two concurrent retries can't both win.
  return query
    update public.email_sends as e
       set status = 'pending',
           attempts = e.attempts + 1,
           last_error = null,
           updated_at = pg_catalog.now()
     where e.stripe_event_id = p_stripe_event_id
       and e.template = p_template
       and (e.status = 'failed'
            or (e.status = 'pending' and e.updated_at < pg_catalog.now() - interval '15 minutes'))
    returning e.id, e.attempts;
end;
$$;

revoke execute on function public.email_send_claim(text, text) from public, anon, authenticated;
grant execute on function public.email_send_claim(text, text) to service_role;

-- Record the outcome of a claimed send. Only a 'pending' row changes; returns whether it did.
create or replace function public.email_send_finish(
  p_id uuid,
  p_status text,
  p_resend_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_id is null or p_status is null or p_status not in ('sent', 'failed') then
    raise exception using message = 'email_send_finish: invalid arguments', errcode = '22023';
  end if;

  update public.email_sends
     set status = p_status,
         resend_id = case when p_status = 'sent' then pg_catalog.left(p_resend_id, 128) else resend_id end,
         last_error = case when p_status = 'failed'
                           then pg_catalog.left(coalesce(nullif(p_error, ''), 'failed'), 200)
                           else null end,
         updated_at = pg_catalog.now()
   where id = p_id and status = 'pending';
  return found;
end;
$$;

revoke execute on function public.email_send_finish(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.email_send_finish(uuid, text, text, text) to service_role;
