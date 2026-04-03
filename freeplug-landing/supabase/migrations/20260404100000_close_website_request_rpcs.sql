-- User-initiated close: withdraw early, or close intake when transfer handoff is acknowledged (milestone + notes required).

create or replace function public.cancel_own_website_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.website_requests
  set status = 'closed', updated_at = now()
  where user_id = auth.uid()
    and status in ('submitted', 'in_review');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using
      message = 'No open request to close.',
      errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.cancel_own_website_request() to authenticated;

-- Replace acknowledge: enforce milestone + handoff text; then close any open intake for this user.
create or replace function public.acknowledge_website_transfer()
returns void
language plpgsql
security definer
set search_path = public
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
    and status in ('submitted', 'in_review');
end;
$$;
