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
