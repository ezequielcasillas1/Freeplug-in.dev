-- Behaviour test for addon_removals_owed_cleared_how_required_check (20261013091000). LOCAL Docker only.
-- Run after the migrations, inside a transaction that is rolled back, e.g.:
--   (echo "begin;"; for f in supabase/migrations/*.sql; do cat "$f"; echo; done; cat supabase/tests/cleared-how-required.sql; echo "rollback;") \
--     | docker exec -i <local supabase db container> psql -U postgres -v ON_ERROR_STOP=1
do $$
declare v_id uuid;
begin
  begin
    insert into public.addon_removals_owed (stripe_subscription_id, addons, effective_at, cleared_at, cleared_how)
    values ('sub_test_null_how', array['small_edit'], now(), now(), null);
    raise exception 'FAIL: insert with cleared_at set and cleared_how NULL was accepted';
  exception when check_violation then
    raise notice 'ok: insert rejected (%)', sqlerrm;
  end;

  insert into public.addon_removals_owed (stripe_subscription_id, addons, effective_at)
  values ('sub_test_open', array['small_edit'], now()) returning id into v_id;
  begin
    update public.addon_removals_owed set cleared_at = now(), cleared_how = null where id = v_id;
    raise exception 'FAIL: update to cleared_at set and cleared_how NULL was accepted';
  exception when check_violation then
    raise notice 'ok: update rejected (%)', sqlerrm;
  end;

  update public.addon_removals_owed set cleared_at = now(), cleared_how = 'kept' where id = v_id;
  raise notice 'ok: a proper clear (cleared_how = kept) still works';
end $$;
