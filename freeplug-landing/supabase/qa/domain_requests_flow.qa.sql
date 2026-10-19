-- QA checks for 20261019120000_domain_requests_flow.sql. Run on a NON-LIVE database after applying,
-- inside a transaction that is rolled back (psql -v uid=<auth.users id> -f, from freeplug-landing/). Replace :uid with a real auth.users id on that database.
begin;

-- 1) authenticated cannot insert directly (expect: ERROR permission denied for table domain_requests)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
savepoint a;
insert into public.domain_requests (user_id, kind, domain, consent_at, consent_text, consent_locale)
values (:'uid', 'buy_for_me', 'x.com', '2020-01-01', 'anything', 'en');
rollback to savepoint a;
reset role;

-- 2) service role: wrong wording rejected (expect: ERROR consent_text must be the official en wording)
set local role service_role;
savepoint b;
insert into public.domain_requests (user_id, kind, domain, consent_text, consent_locale)
values (:'uid', 'buy_for_me', 'x.com', 'anything', 'en');
rollback to savepoint b;

-- 3) official wording accepted; backdated consent_at is overwritten with now() (expect: t)
insert into public.domain_requests (user_id, kind, domain, consent_at, consent_text, consent_locale)
values (:'uid', 'buy_for_me', 'x.com', '2020-01-01',
  'Entiendo que, si esta oferta cambia, Freeplug podría cobrar la renovación anual del dominio a mi tarjeta registrada y me avisará antes de hacerlo.', 'es')
returning consent_at > now() - interval '1 minute' as stamped_now;

-- 4) other kinds drop consent fields (expect: null, null)
insert into public.domain_requests (user_id, kind, consent_text, consent_locale)
values (:'uid', 'buy_self', 'anything', 'en') returning consent_text, consent_locale;

-- 5) domain rule (each expect: ERROR violates check constraint domain_requests_domain_check)
savepoint c; insert into public.domain_requests (user_id, kind, domain) values (:'uid', 'have_domain', '..com'); rollback to savepoint c;
savepoint c; insert into public.domain_requests (user_id, kind, domain) values (:'uid', 'have_domain', 'a..b.com'); rollback to savepoint c;
savepoint c; insert into public.domain_requests (user_id, kind, domain) values (:'uid', 'have_domain', '-a-.com'); rollback to savepoint c;
savepoint c; insert into public.domain_requests (user_id, kind, domain) values (:'uid', 'have_domain', repeat('a', 64) || '.com'); rollback to savepoint c;
-- accepted: punycode label + punycode TLD
insert into public.domain_requests (user_id, kind, domain) values (:'uid', 'have_domain', 'xn--caf-dma.xn--p1ai');
reset role;

-- 6) trigger role check: grant UPDATE to authenticated INSIDE this rolled-back transaction so the
--    trigger (not the grant) is what refuses. Expect: ERROR consent fields and kind cannot be changed
grant update on table public.domain_requests to authenticated;
create policy qa_tmp_update on public.domain_requests for update to authenticated using (true) with check (true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
savepoint d;
update public.domain_requests set consent_text = 'x' where kind = 'buy_for_me' and user_id = :'uid';
rollback to savepoint d;
--    status-only change by the same role passes the trigger (expect: UPDATE n, no error)
update public.domain_requests set status = 'connecting' where kind = 'buy_for_me' and user_id = :'uid';
reset role;

-- 7) service_role may change status (expect: UPDATE n)
set local role service_role;
update public.domain_requests set status = 'live' where user_id = :'uid' and kind = 'buy_for_me';

-- 8) switching to buy_for_me needs the official wording, even for service_role
--    (expect: ERROR switching to buy_for_me needs the official consent wording)
savepoint e;
update public.domain_requests set kind = 'buy_for_me', domain = 'y.com', consent_text = 'x', consent_locale = 'en'
where user_id = :'uid' and kind = 'buy_self';
rollback to savepoint e;
--    with the official wording it passes (expect: UPDATE 1)
update public.domain_requests set kind = 'buy_for_me', domain = 'y.com', consent_text = 'Entiendo que, si esta oferta cambia, Freeplug podría cobrar la renovación anual del dominio a mi tarjeta registrada y me avisará antes de hacerlo.', consent_locale = 'es', consent_at = now()
where user_id = :'uid' and kind = 'buy_self';

-- 9) backup domain rule (expect: ERROR domain_requests_backup_domain_check)
savepoint f;
insert into public.domain_requests (user_id, kind, domain, backup_domain, consent_text, consent_locale)
values (:'uid', 'buy_for_me', 'x.com', 'a..b.com', 'Entiendo que, si esta oferta cambia, Freeplug podría cobrar la renovación anual del dominio a mi tarjeta registrada y me avisará antes de hacerlo.', 'es');
rollback to savepoint f;
reset role;

-- 10) anon cannot insert (expect: ERROR permission denied for table domain_requests)
set local role anon;
savepoint g;
insert into public.domain_requests (user_id, kind) values (:'uid', 'buy_self');
rollback to savepoint g;
reset role;

-- 11) own rows readable, others not. Expect: own_rows > 0, other_rows = 0
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
select count(*) filter (where user_id = :'uid') as own_rows, count(*) filter (where user_id <> :'uid') as other_rows
from public.domain_requests;
reset role;

-- 12) legacy pre-check (expect 0 rows): \i supabase/qa/domain_requests_legacy_precheck.sql
\i supabase/qa/domain_requests_legacy_precheck.sql

rollback;
