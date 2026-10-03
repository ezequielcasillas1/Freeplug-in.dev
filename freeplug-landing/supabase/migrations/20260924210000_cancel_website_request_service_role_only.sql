-- Close-request hardening.
--
-- cancel_own_website_request() was executable by every signed-in user (and anon/public), so a
-- customer could close their request straight through the Supabase API and skip the server's
-- Stripe "active plan" check. The dashboard server action now verifies the signed-in user and the
-- Stripe check first, then closes the request with the service-role client via the function below.
--
-- The RLS UPDATE policy "website_requests_update_own_open" (see 20260405120000) already requires
-- status = 'submitted' in both USING and WITH CHECK, so a direct table UPDATE cannot set status to
-- 'closed' or 'in_review'; users can still edit the details of their own submitted request.
-- No policy change is needed here.

-- 1) Lock down the original auth.uid()-based function (kept for reference; no longer called by the app).
revoke execute on function public.cancel_own_website_request() from public, anon, authenticated;
grant execute on function public.cancel_own_website_request() to service_role;

-- 2) Service-role-only variant: same status rules, but the caller passes the verified user id.
create or replace function public.cancel_website_request_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_user_id is null then
    raise exception using
      message = 'No open request to close.',
      errcode = 'P0001';
  end if;

  update public.website_requests
  set status = 'closed', updated_at = now()
  where user_id = p_user_id
    and status in ('submitted', 'in_review');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using
      message = 'No open request to close.',
      errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.cancel_website_request_for_user(uuid) from public, anon, authenticated;
grant execute on function public.cancel_website_request_for_user(uuid) to service_role;
