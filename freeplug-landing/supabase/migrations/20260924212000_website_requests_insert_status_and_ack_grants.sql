-- Two RLS / grant gaps.
--
-- 1) website_requests INSERT: the policy only checked ownership, so a signed-in user could insert
--    a row straight through the Supabase API with status 'in_review' or 'closed'. New rows must
--    start as 'submitted' (the column default; the app's request form sets it explicitly too).
--
-- 2) acknowledge_website_transfer(): executable by PUBLIC and anon. It is SECURITY DEFINER and
--    keyed on auth.uid(), so anon calls just fail, but there is no reason to expose it. The only
--    caller is the dashboard server action acknowledgeWebsiteTransfer()
--    (src/app/(dashboard)/dashboard/transfer-actions.ts), which runs it with the signed-in user's
--    server client, so authenticated keeps EXECUTE; anon and PUBLIC lose it.

drop policy if exists "website_requests_insert_own" on public.website_requests;
create policy "website_requests_insert_own"
  on public.website_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'submitted');

revoke execute on function public.acknowledge_website_transfer() from public, anon;
grant execute on function public.acknowledge_website_transfer() to authenticated, service_role;
