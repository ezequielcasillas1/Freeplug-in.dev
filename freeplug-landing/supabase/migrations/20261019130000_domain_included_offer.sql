-- "First 100 clients: the monthly hosting fee includes the domain purchase" (Cheke, Oct 19 2026 12:02 PM CT).
-- One claim per user, made when a buy_for_me request is saved. The count is the number of
-- domain_requests rows with domain_included = true (no separate counter that could drift). Claims go
-- through create_buy_for_me_request(), which locks the offer row FOR UPDATE, so concurrent saves are
-- serialized and the count never passes the cap. After the cap, buy_for_me still saves (not included).
-- Old need_domain rows never count. Requires 20261019120000 (consent guard trigger still applies).

create table if not exists public.domain_offers (
  key text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  cap integer not null check (cap >= 0),
  created_at timestamptz not null default now()
);
alter table public.domain_offers enable row level security;
revoke all on table public.domain_offers from public, anon, authenticated;
grant select, insert, update on table public.domain_offers to service_role;
insert into public.domain_offers (key, cap) values ('first_100_domain_included', 100) on conflict (key) do nothing;

alter table public.domain_requests add column if not exists domain_included boolean not null default false;

alter table public.domain_requests drop constraint if exists domain_requests_included_kind_check;
alter table public.domain_requests add constraint domain_requests_included_kind_check
  check (not domain_included or kind = 'buy_for_me') not valid;
alter table public.domain_requests validate constraint domain_requests_included_kind_check;

-- One included domain per user.
create unique index if not exists domain_requests_one_included_per_user
  on public.domain_requests (user_id) where domain_included;

-- Saves one buy_for_me request and claims an included spot if one is left and the user has none.
-- Returns the new id, whether it was included, why not, the count after this save and the cap.
create or replace function public.create_buy_for_me_request(
  p_user_id uuid,
  p_domain text,
  p_backup_domain text,
  p_locale text,
  p_consent_text text,
  p_consent_locale text
)
returns table (id uuid, included boolean, reason text, claimed integer, cap integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cap integer;
  v_claimed integer;
  v_already boolean;
  v_included boolean;
  v_id uuid;
begin
  -- Serializes every claim on this offer (two saves racing for the last spot: one waits).
  select o.cap into v_cap from public.domain_offers o where o.key = 'first_100_domain_included' for update;
  v_cap := coalesce(v_cap, 0);
  select count(*)::integer into v_claimed from public.domain_requests r where r.domain_included;
  select exists (select 1 from public.domain_requests r where r.user_id = p_user_id and r.domain_included) into v_already;
  v_included := not v_already and v_claimed < v_cap;

  insert into public.domain_requests (user_id, kind, domain, backup_domain, locale, consent_text, consent_locale, domain_included)
  values (p_user_id, 'buy_for_me', p_domain, nullif(p_backup_domain, ''), p_locale, p_consent_text, p_consent_locale, v_included)
  returning domain_requests.id into v_id;

  return query select v_id, v_included,
    case when v_included then 'included' when v_already then 'already_claimed' else 'offer_ended' end,
    v_claimed + (case when v_included then 1 else 0 end), v_cap;
end;
$$;
revoke all on function public.create_buy_for_me_request(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_buy_for_me_request(uuid, text, text, text, text, text) to service_role;

-- Page + admin count (service role only).
create or replace function public.domain_offer_status()
returns table (claimed integer, cap integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select (select count(*)::integer from public.domain_requests r where r.domain_included),
         coalesce((select o.cap from public.domain_offers o where o.key = 'first_100_domain_included'), 0);
$$;
revoke all on function public.domain_offer_status() from public, anon, authenticated;
grant execute on function public.domain_offer_status() to service_role;
