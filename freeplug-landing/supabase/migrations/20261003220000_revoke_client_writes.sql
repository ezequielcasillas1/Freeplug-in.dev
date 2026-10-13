-- 20261003220000_revoke_client_writes.sql (Owen, Sat Oct 3 2026, staging-r13 round 12; Aria's ruling on the round-11
-- grants question, her 3:31 PM CT addition; round 13: her 4:38 PM CT rulings 1 + 2; round 14: her rulings 1 + 2 after
-- round 13). PENDING: not applied anywhere hosted, not on the db push hash list or
-- the apply-file repair list; for a later round with its own go. Sorts after 20261003210000_plan_change_locks.sql (it
-- needs every table below to exist: run the ladder migrations 20261003160000 and 20261003180000-20261003210000 first).
--
-- 1. Table writes. anon and authenticated lose INSERT, UPDATE and DELETE on the tables only the SERVER writes (the app
--    writes them with the service-role admin client, or through SECURITY DEFINER functions / triggers). With the grant
--    gone a client write fails with 42501 (permission denied) before RLS is even asked, instead of relying on "no
--    policy" alone. SELECT is untouched (RLS still filters the customer's own rows). service_role keeps everything.
--    Grants inventory (scratch, Supabase default privileges modelled: tests/r13db.sh revinv; launch 18 + email_sends +
--    20261003180000-20261003210000), INSERT / UPDATE / DELETE / TRUNCATE held by anon / authenticated BEFORE this file:
--      billing_ledger    anon + authenticated: DELETE INSERT TRUNCATE UPDATE   -> server only (Stripe webhook, admin)
--      profiles          anon + authenticated: DELETE INSERT TRUNCATE UPDATE   -> server only (admin client; inserts by
--                        handle_new_user() / ensure_own_profile(), both SECURITY DEFINER; tipping + plan columns)
--      website_requests  anon + authenticated: DELETE INSERT TRUNCATE UPDATE   -> KEPT: the dashboard inserts / updates
--                        it with the customer's own session (request-website/actions.ts); RLS decides
--      domain_requests   authenticated: INSERT                                  -> KEPT: dashboard/domain/actions.ts
--    and none on: outreach_sites (tipping), email_sends, plan_change_locks, plan_unsold_purchases, included_edit_uses
--    (their files already revoke them); revoked here too, so the rule holds even if a grant comes back later.
--    Round 13 (Aria 4:38 PM CT): TRUNCATE, REFERENCES and TRIGGER are revoked too (RLS does not cover TRUNCATE).
--    profiles stays on the list on the proof in staging-r13/PROFILES-WRITE-PROOF.md: no app write to profiles uses the
--    customer's session (every .update() goes through the admin client), and every function / trigger that writes
--    profiles is SECURITY DEFINER (owner postgres), so a client-session call still works without table privileges.
--    outreach_sites stays (Aria). website_requests and domain_requests table grants are NOT touched.
--    Later (Aria): profiles.locale from the translation card must be written by the SERVER (admin client or a
--    SECURITY DEFINER function), never with the customer's session: after this file a session write fails with 42501.
-- 2. Function. EXECUTE on public.acknowledge_website_transfer() is revoked from authenticated, anon and PUBLIC (Aria
--    3:31 PM CT). App callers: none (freeplug-ladder freeplug-landing/src and freeplug-in-dev: no .rpc call; only the
--    generated types mention its columns). It stays callable by service_role (and its owner), the server path; the
--    body still acts on auth.uid() only. hosted-probe row 15: once this version is recorded, the accept state expects
--    authenticated / anon / PUBLIC to have NO execute on it; before, it expects the launch grant to authenticated.
--    Round 14 (Aria ruling 6): it stays service_role-only here; it is DROPPED in a later migration after the rename
--    follow-up (it is one of the pinned pair's objects and probe row 15 reads it): staging-r13/followup-rename/README.md.
-- 3. Sequences (round 13, Aria 4:38 PM CT): anon and authenticated lose USAGE and UPDATE (nextval / setval) on every
--    sequence in public EXCEPT one owned by a column of website_requests or domain_requests (the two tables the
--    customer's session inserts into). Inventory at this version (scratch, the full ladder chain): ONE sequence,
--    public.rate_limit_hits_id_seq (rate_limit_hits.id, an identity column); rate_limit_hits is written only by
--    rate_check() (SECURITY DEFINER) and lib/rate-limit/event-log.ts through the admin client, never by a user session.
--    website_requests and domain_requests have uuid keys (no sequence today); the exception is kept for the rule.
--    Round 14 (Aria, after round 13): ALL privileges (USAGE, SELECT, UPDATE) are revoked, so anon and authenticated
--    hold nothing on rate_limit_hits_id_seq (rate_check() and service_role still insert: tests/r13db.sh rolesmoke2).
-- 4. Default privileges for sequences (round 14, Aria ruling 1): a sequence postgres creates LATER in public no longer
--    gets the platform default grants to anon / authenticated. Sequences only: table default privileges are NOT
--    changed here (they go with 20260927051000 later). Drift check: hosted-probe row 20 reports any public sequence
--    where anon / authenticated holds any privilege (except one owned by website_requests / domain_requests) and any
--    pg_default_acl entry (any role, any schema) that grants sequences to them.
-- Idempotent: REVOKE of a privilege that is not held is a no-op (re-run tested on scratch).
revoke insert, update, delete, truncate, references, trigger on table public.billing_ledger from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.outreach_sites from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.email_sends from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.plan_change_locks from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.plan_unsold_purchases from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.included_edit_uses from anon, authenticated;

revoke execute on function public.acknowledge_website_transfer() from public, anon, authenticated;
grant execute on function public.acknowledge_website_transfer() to service_role;

do $revoke_seq$
declare r record; n int := 0;
begin
  for r in
    select c.oid::regclass as seq
      from pg_class c
     where c.relkind = 'S' and c.relnamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype in ('a', 'i')
                          and d.refclassid = 'pg_class'::regclass
                          and d.refobjid in ('public.website_requests'::regclass, 'public.domain_requests'::regclass))
     order by 1
  loop
    execute format('revoke all on sequence %s from anon, authenticated', r.seq);
    n := n + 1;
    raise notice '20261003220000: revoked ALL (USAGE, SELECT, UPDATE) on sequence % from anon, authenticated', r.seq;
  end loop;
  raise notice '20261003220000: % public sequence(s) revoked (website_requests / domain_requests sequences kept)', n;
end
$revoke_seq$;

alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
