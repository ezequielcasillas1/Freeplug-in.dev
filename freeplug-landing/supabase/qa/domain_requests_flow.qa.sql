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

-- ===== First-100 domain-included offer (migration 20261019130000). Separate rolled-back transaction.
-- Needs 2 real auth.users ids on the test DB: psql -v uid=<id1> -v uid2=<id2> -f ...
begin;
set local role service_role;
-- C1) shrink the cap to make it testable: cap = current count + 1
update public.domain_offers set cap = (select count(*) from public.domain_requests where domain_included) + 1
where key = 'first_100_domain_included';
-- C2) first claim takes the last spot (expect: included t, reason included, claimed = cap)
select * from public.create_buy_for_me_request(:'uid', 'x.com', '', 'en',
  'I understand that if this offer changes, Freeplug may charge my card on file for the yearly domain renewal, and will tell me before it does.', 'en');
-- C3) same user again (expect: included f, reason already_claimed; row still saved)
select * from public.create_buy_for_me_request(:'uid', 'y.com', '', 'en',
  'I understand that if this offer changes, Freeplug may charge my card on file for the yearly domain renewal, and will tell me before it does.', 'en');
-- C4) another user after the cap (expect: included f, reason offer_ended, claimed = cap)
select * from public.create_buy_for_me_request(:'uid2', 'z.com', '', 'en',
  'I understand that if this offer changes, Freeplug may charge my card on file for the yearly domain renewal, and will tell me before it does.', 'en');
-- C5) count never above cap (expect: t)
select claimed <= cap as within_cap from public.domain_offer_status();
-- C6) wrong consent wording still rejected through the function (expect: ERROR official en wording)
savepoint h;
select * from public.create_buy_for_me_request(:'uid2', 'w.com', '', 'en', 'anything', 'en');
rollback to savepoint h;
-- C7) a second included row for one user is impossible (expect: ERROR duplicate key domain_requests_one_included_per_user)
savepoint i;
update public.domain_requests set domain_included = true where user_id = :'uid' and kind = 'buy_for_me' and not domain_included;
rollback to savepoint i;
-- C8) included only on buy_for_me (expect: ERROR domain_requests_included_kind_check)
savepoint j;
insert into public.domain_requests (user_id, kind, domain_included) values (:'uid2', 'buy_self', true);
rollback to savepoint j;
reset role;
-- C9) customers cannot call the claim or read the offer (expect: ERROR permission denied, twice)
set local role authenticated;
savepoint k; select * from public.create_buy_for_me_request(:'uid', 'v.com', '', 'en', 'x', 'en'); rollback to savepoint k;
savepoint l; select * from public.domain_offers; rollback to savepoint l;
reset role;
-- C10) race (manual, two psql sessions with cap = count + 1): run C2 in both inside BEGIN; the
-- second blocks on the offer row lock until the first commits, then returns offer_ended.
rollback;
