-- Aria's ruling on f36a910 (Oct 22, 8:37 PM CT): customers can close their own request at
-- submitted, in_review, consultation and agreed, but NOT at building. At building the dashboard
-- offers "Request to cancel" (a team alert; the status is unchanged). The close functions refuse
-- building here too, so no caller can get around the app.
--
-- ONE shared definition, like website_request_is_open (20261022200000). TS twin:
-- SELF_CLOSABLE_STATUSES in src/lib/consultation/status.ts; open-status-sync.test.ts fails on drift.
-- acknowledge_website_transfer is not a customer cancel (it closes intake after the website handoff)
-- and keeps website_request_is_open.

create or replace function public.website_request_is_self_closable(p_status text)
returns boolean
language sql
immutable
parallel safe
as $$ select public.website_request_is_open(p_status) and p_status <> 'building' $$;

grant execute on function public.website_request_is_self_closable(text) to anon, authenticated, service_role;

-- Shared body: close the user's self-closable open request; a building request gets its own error
-- (hint 'building') so the app can point to "Request to cancel".
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
    and public.website_request_is_self_closable(status);
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.website_requests w where w.user_id = p_user_id and w.status = 'building') then
      raise exception using
        message = 'Your website is being built, so this request can''t be closed here. Use Request to cancel.',
        errcode = 'P0001', hint = 'building';
    end if;
    raise exception using message = 'No open request to close.', errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.cancel_website_request_for_user(uuid) from public, anon, authenticated;
grant execute on function public.cancel_website_request_for_user(uuid) to service_role;

create or replace function public.cancel_own_website_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.cancel_website_request_for_user(auth.uid());
end;
$$;

revoke execute on function public.cancel_own_website_request() from public, anon, authenticated;
grant execute on function public.cancel_own_website_request() to service_role;
