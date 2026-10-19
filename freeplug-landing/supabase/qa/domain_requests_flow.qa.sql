-- QA checks for 20261019120000_domain_requests_flow.sql. Run on a NON-LIVE database after applying,
-- inside a transaction that is rolled back. Replace :uid with a real auth.users id on that database.
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

-- 6) authenticated cannot change consent (no UPDATE grant; trigger also blocks): expect ERROR
set local role authenticated;
savepoint d;
update public.domain_requests set consent_text = 'x' where kind = 'buy_for_me';
rollback to savepoint d;
reset role;

rollback;
