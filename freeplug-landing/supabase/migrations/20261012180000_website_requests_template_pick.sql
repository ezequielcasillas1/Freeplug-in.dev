-- Customer template picker (Aria, Oct 12 2026). All columns nullable; no new status values,
-- no license fields, and NO client UPDATE policy: picks are saved only by the server action
-- (service-role client). The existing website_requests_update_own_open policy still lets an owner
-- update their own 'submitted' row, so a guard trigger (same pattern as website_requests_guard_source)
-- refuses any anon/authenticated insert or update that sets or changes these columns (42501).
--
-- business_type keys = NICHES in src/lib/envato/niche-tags.ts (Lina's 20 shortlist keys).
-- template_locked_at is set by the admin action when Lina approves the pick or a license is recorded.

alter table public.website_requests add column if not exists business_type text;
alter table public.website_requests add column if not exists template_choice text;
alter table public.website_requests add column if not exists envato_item_id bigint;
alter table public.website_requests add column if not exists pasted_template_url text;
alter table public.website_requests add column if not exists template_picked_at timestamptz;
alter table public.website_requests add column if not exists template_locked_at timestamptz;

alter table public.website_requests drop constraint if exists website_requests_business_type_check;
alter table public.website_requests add constraint website_requests_business_type_check check (
  business_type is null or business_type in (
    'restaurant_texmex', 'food_truck', 'medical_clinic', 'dental', 'hvac', 'plumbing_electrical',
    'roofing_remodel', 'landscaping_lawn', 'cleaning', 'auto_repair', 'salon_barber', 'fitness',
    'legal', 'real_estate', 'insurance_tax', 'church', 'child_care', 'pet_care', 'event_venue',
    'other_local'
  )
);

alter table public.website_requests drop constraint if exists website_requests_template_choice_check;
alter table public.website_requests add constraint website_requests_template_choice_check check (
  template_choice is null or template_choice in ('envato_catalog', 'client_pasted', 'team_pick')
);

alter table public.website_requests drop constraint if exists website_requests_pasted_template_url_check;
alter table public.website_requests add constraint website_requests_pasted_template_url_check check (
  pasted_template_url is null
  or (left(pasted_template_url, 29) = 'https://themeforest.net/item/' and length(pasted_template_url) <= 500)
);

alter table public.website_requests drop constraint if exists website_requests_template_pick_consistency_check;
alter table public.website_requests add constraint website_requests_template_pick_consistency_check check (
  -- searched CASE (not OR) so a NULL template_choice can't make the whole check NULL (= pass)
  case
    when template_choice is null then envato_item_id is null and pasted_template_url is null
    when template_choice = 'envato_catalog' then envato_item_id is not null and pasted_template_url is null
    when template_choice = 'client_pasted' then pasted_template_url is not null and envato_item_id is null
    when template_choice = 'team_pick' then envato_item_id is null and pasted_template_url is null
    else false
  end
);

create or replace function public.website_requests_guard_template_pick()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
begin
  if tg_op = 'INSERT' and new.business_type is null and new.template_choice is null
     and new.envato_item_id is null and new.pasted_template_url is null
     and new.template_picked_at is null and new.template_locked_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.business_type is not distinct from old.business_type
     and new.template_choice is not distinct from old.template_choice
     and new.envato_item_id is not distinct from old.envato_item_id
     and new.pasted_template_url is not distinct from old.pasted_template_url
     and new.template_picked_at is not distinct from old.template_picked_at
     and new.template_locked_at is not distinct from old.template_locked_at then
    return new;
  end if;
  if current_user = 'service_role'
     or (current_user in ('postgres', 'supabase_admin')
         and coalesce(jwt_role, '') not in ('anon', 'authenticated')) then
    return new;
  end if;
  raise exception using
    message = 'template pick can only be set by the server (service role).',
    errcode = '42501';
end;
$$;

revoke execute on function public.website_requests_guard_template_pick() from public, anon, authenticated;

drop trigger if exists website_requests_guard_template_pick on public.website_requests;
create trigger website_requests_guard_template_pick
  before insert or update on public.website_requests
  for each row execute function public.website_requests_guard_template_pick();
