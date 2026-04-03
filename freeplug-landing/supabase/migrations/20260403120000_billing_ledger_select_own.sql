-- Let users read their own invoice ledger rows (for dashboard counts).
drop policy if exists "billing_ledger_select_own" on public.billing_ledger;
create policy "billing_ledger_select_own"
  on public.billing_ledger for select
  to authenticated
  using (profile_id = auth.uid());
