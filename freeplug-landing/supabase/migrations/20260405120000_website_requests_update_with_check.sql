-- Tighten UPDATE WITH CHECK so status cannot leave 'submitted' via this policy.
drop policy if exists "website_requests_update_own_open" on public.website_requests;
create policy "website_requests_update_own_open"
  on public.website_requests for update
  to authenticated
  using (auth.uid() = user_id and status = 'submitted')
  with check (auth.uid() = user_id and status = 'submitted');
