-- PROVISIONAL VERSION (Aria, Oct 13; confirm in the PR): this file was 20260403120000_website_transfer_handoff.sql,
-- a duplicate of 20260403120000_billing_ledger_select_own.sql's version, which made a fresh `supabase migration up`
-- fail with 23505 on schema_migrations_pkey. CLI order applies: the file that sorts first keeps 20260403120000,
-- this one moves to 20260403120001. On hosted, if its objects already exist, record it with
-- `supabase migration repair --status applied 20260403120001` instead of applying it (see the hosted checklist).
-- Statements are unchanged and idempotent.
-- After website value milestone: admin-written handoff notes; customer can acknowledge via RPC only.
alter table public.profiles
  add column if not exists website_transfer_notes text,
  add column if not exists website_transfer_acknowledged_at timestamptz;

comment on column public.profiles.website_transfer_notes is 'Shown to customer when website value milestone reached; set by service role / admin.';
comment on column public.profiles.website_transfer_acknowledged_at is 'Customer confirmed they reviewed handoff (via acknowledge_website_transfer RPC).';

create or replace function public.acknowledge_website_transfer()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    website_transfer_acknowledged_at = now(),
    updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.acknowledge_website_transfer() to authenticated;
