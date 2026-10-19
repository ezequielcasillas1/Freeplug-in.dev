-- Freeplug in Spanish (Aria's translation card v4 §3, BUILD GO Oct 4 2026 9:09 AM CT).
-- profiles.locale: the customer's language for the dashboard, emails and Stripe ('en' | 'es').
-- Adding a language later widens the check constraint. No translated copy is stored in the DB.
-- The owner may change ONLY this column, through set_own_locale(text): profiles has no client
-- UPDATE policy (20260402120000_profiles_and_website_requests.sql) and this does not add one.
-- Idempotent: safe to apply twice.

alter table public.profiles
  add column if not exists locale text not null default 'en';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_locale_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_locale_check check (locale in ('en', 'es'));
  end if;
end;
$$;

-- Owner-only setter. Never takes a user id: it always writes auth.uid()'s own row.
create or replace function public.set_own_locale(p_locale text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception using message = 'Sign in to save your language.', errcode = '42501';
  end if;
  if p_locale is null or p_locale not in ('en', 'es') then
    raise exception using message = 'Unsupported language.', errcode = '22023';
  end if;
  update public.profiles
  set locale = p_locale, updated_at = now()
  where id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using message = 'No profile for this account.', errcode = 'P0002';
  end if;
  return p_locale;
end;
$$;

revoke all on function public.set_own_locale(text) from public;
revoke all on function public.set_own_locale(text) from anon;
grant execute on function public.set_own_locale(text) to authenticated;

-- New accounts start in the language they signed up in (sign-up sets user metadata `locale`, card
-- R6). Only 'es' is copied; anything else (missing, Google sign-ups, junk) stays the 'en' default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
