-- "Set up your domain" upgrade (Oct 19 2026): three choices, registrar / backup domain, the Beta
-- consent for "Buy a domain for me", and the status steps Request saved (pending) -> Connecting -> Live.
-- Old rows stay valid: need_domain is still allowed (shown as "I'll buy my own domain"), 'done' = Live.
-- Customers keep SELECT on their own rows (RLS). Customers can NO LONGER insert directly (QA bug 1:
-- a direct PostgREST insert could forge consent and skip the email + owner alert): the dashboard
-- server action checks auth + consent and inserts with the service role. A trigger also stamps
-- consent_at = now() and only accepts the official EN/ES consent wording (defense in depth).
-- Constraint names below were read from live (ldlyjoybppmwvvcarewq) on Oct 19 2026, read-only:
--   domain_requests_check, domain_requests_domain_check, domain_requests_kind_check,
--   domain_requests_notes_check (kept), domain_requests_status_check.
-- QA SQL checks (run once applied, on a non-live DB): supabase/qa/domain_requests_flow.qa.sql

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

-- Hostname rule (same as the app, flow.ts DOMAIN_RE): labels 1-63 of [a-z0-9-], no leading/trailing
-- hyphen, no empty labels; TLD letters or punycode (xn--). Lowercase only (the app lowercases).
alter table public.domain_requests drop constraint if exists domain_requests_domain_check;
alter table public.domain_requests add constraint domain_requests_domain_check
  check (domain is null or (length(domain) between 3 and 253
    and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$'));

alter table public.domain_requests drop constraint if exists domain_requests_registrar_check;
alter table public.domain_requests add constraint domain_requests_registrar_check
  check (registrar is null or length(registrar) <= 100);

alter table public.domain_requests drop constraint if exists domain_requests_backup_domain_check;
alter table public.domain_requests add constraint domain_requests_backup_domain_check
  check (backup_domain is null or (length(backup_domain) between 3 and 253
    and backup_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$'));

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

-- No direct customer inserts: the server action inserts with the service role after auth + consent.
drop policy if exists "domain_requests_insert_own" on public.domain_requests;
revoke insert on table public.domain_requests from public, anon, authenticated;

-- Consent guard. Insert: buy_for_me gets consent_at = now() and must carry the exact official wording
-- for its locale; other kinds carry no consent. Update: consent fields never change except by the
-- service role / postgres (admin fixes).
create or replace function public.domain_requests_consent_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  en_text constant text := 'I understand that if this offer changes, Freeplug may charge my card on file for the yearly domain renewal, and will tell me before it does.';
  es_text constant text := 'Entiendo que, si esta oferta cambia, Freeplug podría cobrar la renovación anual del dominio a mi tarjeta registrada y me avisará antes de hacerlo.';
begin
  if tg_op = 'INSERT' then
    if new.kind = 'buy_for_me' then
      if not ((new.consent_locale = 'en' and new.consent_text = en_text)
           or (new.consent_locale = 'es' and new.consent_text = es_text)) then
        raise exception 'domain_requests: consent_text must be the official % wording', coalesce(new.consent_locale, '?')
          using errcode = '23514';
      end if;
      new.consent_at := pg_catalog.now();
    else
      new.consent_at := null;
      new.consent_text := null;
      new.consent_locale := null;
    end if;
  elsif (new.consent_at, new.consent_text, new.consent_locale, new.kind)
        is distinct from (old.consent_at, old.consent_text, old.consent_locale, old.kind)
        and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'domain_requests: consent fields and kind cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.domain_requests_consent_guard() from public, anon, authenticated;

drop trigger if exists domain_requests_consent_guard on public.domain_requests;
create trigger domain_requests_consent_guard
  before insert or update on public.domain_requests
  for each row execute function public.domain_requests_consent_guard();
