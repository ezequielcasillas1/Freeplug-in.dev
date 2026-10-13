-- Three Lows (approved by Aria, Oct 13). Each check is added NOT VALID and is NOT validated here: new and updated rows
-- are checked from now on; existing rows are not scanned. Count existing violations first with
-- supabase/checks/count-bad-rows-20261013091000.sql (read-only) before any VALIDATE CONSTRAINT in a later migration.
-- Idempotent: drop-if-exists, then add. Not applied to any hosted project by this change.

-- (a) addon_removals_owed: a cleared row must say how (cleared_how non-empty once cleared_at is set).
alter table public.addon_removals_owed drop constraint if exists addon_removals_owed_cleared_how_nonempty_check;
alter table public.addon_removals_owed add constraint addon_removals_owed_cleared_how_nonempty_check
  check (cleared_at is null or (cleared_how is not null and pg_catalog.btrim(cleared_how) <> '')) not valid;

-- (b) profiles.plan_addons: a 1-D array only ('{}' has no dimensions, so array_ndims is null and passes).
alter table public.profiles drop constraint if exists profiles_plan_addons_one_dim_check;
alter table public.profiles add constraint profiles_plan_addons_one_dim_check
  check (pg_catalog.array_ndims(plan_addons) is null or pg_catalog.array_ndims(plan_addons) = 1) not valid;

-- (c) change_requests.description: at least one non-whitespace character (btrim only strips spaces).
alter table public.change_requests drop constraint if exists change_requests_description_nonblank_check;
alter table public.change_requests add constraint change_requests_description_nonblank_check
  check (description ~ '\S') not valid;
