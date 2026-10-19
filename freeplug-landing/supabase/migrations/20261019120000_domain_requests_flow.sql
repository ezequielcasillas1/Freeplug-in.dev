-- "Set up your domain" upgrade (Oct 19 2026): three choices, registrar / backup domain, the Beta
-- consent for "Buy a domain for me", and the status steps Request saved (pending) -> Connecting -> Live.
-- Old rows stay valid: need_domain is still allowed (shown as "I'll buy my own domain"), 'done' = Live.
-- RLS and grants are unchanged: customers insert/select their own rows (insert only with status
-- 'pending'); only the service role updates status. No functions are added.

alter table public.domain_requests
  add column if not exists registrar text,
  add column if not exists backup_domain text,
  add column if not exists locale text,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_text text,
  add column if not exists consent_locale text;

alter table public.domain_requests drop constraint if exists domain_requests_kind_check;
alter table public.domain_requests add constraint domain_requests_kind_check
  check (kind in ('have_domain', 'buy_for_me', 'buy_self', 'need_domain'));

-- have_domain and buy_for_me need a domain; buy_self / legacy need_domain don't.
alter table public.domain_requests drop constraint if exists domain_requests_check;
alter table public.domain_requests add constraint domain_requests_check
  check (kind in ('need_domain', 'buy_self') or domain is not null);

alter table public.domain_requests drop constraint if exists domain_requests_status_check;
alter table public.domain_requests add constraint domain_requests_status_check
  check (status in ('pending', 'connecting', 'live', 'done'));

alter table public.domain_requests drop constraint if exists domain_requests_registrar_check;
alter table public.domain_requests add constraint domain_requests_registrar_check
  check (registrar is null or length(registrar) <= 100);

alter table public.domain_requests drop constraint if exists domain_requests_backup_domain_check;
alter table public.domain_requests add constraint domain_requests_backup_domain_check
  check (backup_domain is null or (length(backup_domain) between 3 and 253 and backup_domain ~ '^[A-Za-z0-9.-]+$'));

alter table public.domain_requests drop constraint if exists domain_requests_locale_check;
alter table public.domain_requests add constraint domain_requests_locale_check
  check (locale is null or locale in ('en', 'es'));

alter table public.domain_requests drop constraint if exists domain_requests_consent_locale_check;
alter table public.domain_requests add constraint domain_requests_consent_locale_check
  check (consent_locale is null or consent_locale in ('en', 'es'));

alter table public.domain_requests drop constraint if exists domain_requests_consent_text_check;
alter table public.domain_requests add constraint domain_requests_consent_text_check
  check (consent_text is null or length(consent_text) between 1 and 1000);

-- "Buy a domain for me" is only saved with the consent (when, exact wording, language).
alter table public.domain_requests drop constraint if exists domain_requests_buy_for_me_consent_check;
alter table public.domain_requests add constraint domain_requests_buy_for_me_consent_check
  check (kind <> 'buy_for_me' or (consent_at is not null and consent_text is not null and consent_locale is not null));
