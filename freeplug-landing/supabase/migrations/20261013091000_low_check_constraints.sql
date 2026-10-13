-- Four Lows (approved by Aria, Oct 13; (c) and (d) per Vera's phase 5). Each check is added NOT VALID and is NOT validated here: new and updated rows
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

-- (c) change_requests.description: not blank once spaces, tabs, newlines and carriage returns are trimmed
--     (Vera's form; plain btrim() only strips spaces). Also covers phase 5 L-1.
alter table public.change_requests drop constraint if exists change_requests_description_nonblank_check;
alter table public.change_requests add constraint change_requests_description_nonblank_check
  check (btrim(description, E' \t\n\r') <> '') not valid;

-- (d) change_requests.change_type: only the values the form offers (CHANGE_TYPES in
--     src/lib/help/help-chat-content.ts). Phase 5 L-2: a direct PostgREST insert could store any 1-100 chars.
alter table public.change_requests drop constraint if exists change_requests_change_type_allowed_check;
alter table public.change_requests add constraint change_requests_change_type_allowed_check
  check (change_type in ('Text or prices', 'Photos', 'Hours or contact info', 'Something else')) not valid;
