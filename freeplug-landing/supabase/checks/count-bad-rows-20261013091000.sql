-- Read-only: counts existing rows that would violate the NOT VALID checks in
-- migrations/20261013091000_low_check_constraints.sql. Changes nothing (runs in a read-only transaction).
begin transaction read only;
select 'addon_removals_owed_cleared_how_required_check' as check_name, count(*) as bad_rows
  from public.addon_removals_owed
 where not (cleared_at is null or cleared_how is not null)
union all
select 'profiles_plan_addons_one_dim_check', count(*)
  from public.profiles
 where not (array_ndims(plan_addons) is null or array_ndims(plan_addons) = 1)
union all
select 'change_requests_description_nonblank_check', count(*)
  from public.change_requests
 where description is not null and not (btrim(description, E' \t\n\r') <> '')
union all
select 'change_requests_change_type_allowed_check', count(*)
  from public.change_requests
 where change_type is not null and change_type not in ('Text or prices', 'Photos', 'Hours or contact info', 'Something else');
rollback;
