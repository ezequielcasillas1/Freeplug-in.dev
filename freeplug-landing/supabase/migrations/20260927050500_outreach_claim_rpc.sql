-- Claim an outreach site (Aria, section 8; Vera rule 6).
--
-- claim_outreach_site(p_site_id, p_user_id): EXECUTE for service_role only. The server resolves
-- the site id from the preview token / signed cookie and the user id from the verified session;
-- it never takes either from the client. Rules:
--   * The user's email must be confirmed (auth.users.email_confirmed_at; Google sign-in counts).
--   * One atomic UPDATE ... WHERE claimed_by IS NULL AND revoked_at IS NULL AND expires_at > now().
--   * Idempotent: the same user claiming again gets the same result. A different user is refused.
--   * Claiming kills the link (the token lookup requires claimed_by IS NULL).
--   * Same transaction: link or create the user's website_requests row with source 'outreach',
--     so the existing hosting checkout eligibility and admin lists keep working. If the user
--     already has an open organic request (one open request per user), it is linked instead.

create or replace function public.claim_outreach_site(p_site_id uuid, p_user_id uuid)
returns table (site_id uuid, website_request_id uuid, already_claimed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.outreach_sites;
  confirmed timestamptz;
  req_id uuid;
begin
  if p_site_id is null or p_user_id is null then
    raise exception using message = 'Invalid claim.', errcode = '22023';
  end if;

  select u.email_confirmed_at into confirmed from auth.users u where u.id = p_user_id;
  if confirmed is null then
    raise exception using message = 'Confirm your email before claiming.', errcode = 'P0001', hint = 'email_unconfirmed';
  end if;

  select * into s from public.outreach_sites where id = p_site_id for update;
  if not found then
    raise exception using message = 'This preview link has expired.', errcode = 'P0001', hint = 'link_invalid';
  end if;

  if s.claimed_by is not null then
    if s.claimed_by = p_user_id then
      select w.id into req_id from public.website_requests w
      where w.user_id = p_user_id and w.outreach_site_id = p_site_id
      order by w.created_at desc limit 1;
      return query select p_site_id, req_id, true;
      return;
    end if;
    raise exception using message = 'This website was already claimed.', errcode = 'P0001', hint = 'claimed_by_other';
  end if;

  update public.outreach_sites
  set claimed_by = p_user_id, claimed_at = now(), updated_at = now()
  where id = p_site_id
    and claimed_by is null
    and revoked_at is null
    and expires_at > now();
  if not found then
    raise exception using message = 'This preview link has expired.', errcode = 'P0001', hint = 'link_invalid';
  end if;

  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;

  select w.id into req_id from public.website_requests w
  where w.user_id = p_user_id and w.status in ('submitted', 'in_review')
  order by w.updated_at desc limit 1
  for update;

  if req_id is null then
    insert into public.website_requests (user_id, business_name, status, source, outreach_site_id)
    values (p_user_id, s.business_name, 'submitted', 'outreach', p_site_id)
    returning id into req_id;
  else
    update public.website_requests
    set outreach_site_id = p_site_id, updated_at = now()
    where id = req_id;
  end if;

  return query select p_site_id, req_id, false;
end;
$$;

revoke execute on function public.claim_outreach_site(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_outreach_site(uuid, uuid) to service_role;
