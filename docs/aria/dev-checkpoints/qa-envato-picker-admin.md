# QA checkpoint: envato-picker-admin @ d5fca60 (Grok Bot QA, Mon Oct 12 2026 ~12:50 PM CT)
Report: /workspace/freeplug-qa/envato-picker-qa/REPORT-d5fca60.md (overall PASS, 0 High/0 Medium, 1 Low, 6 Info).
Done: items 1-11 (live curl 404s + header spoofing, token scans, local RLS via SET ROLE + anon REST, code review of sync/partitions/cron/tagger, vitest in a private clone, DB counts, :3001 check, Arkitect lint + tsc + tests), plus signed-out screenshots.
Nothing changed on :3000, its DB or Owen's files. No sync, no planted rows.
Remaining:
- Signed-in admin screenshots at 375/1280 and the Cleaning / Not cleaning decide flow. These need an approved admin account (and a planted Needs Lina row on a non-review DB).
- Signed-in non-admin 404 check (needs a non-admin test user).
- Decide on I1: keep the hotel flag as housekeeping-only (spec §3.4), or broaden it to all cleaning terms + hotel/resort/booking.
- L1: keep .next/cache out of any copy; rotate the token if it leaves the box.
Private clone (safe to delete): /workspace/freeplug-qa/envato-picker-qa/clone

## Retest @ eb532a7 (Mon Oct 12 2026, ~1:00 PM CT)
Report: /workspace/freeplug-qa/envato-picker-qa/REPORT-eb532a7.md. Overall PASS (0 High, 0 Medium; Low: L1 token in 4 Turbopack dev cache files on :3000, L2 table overflows at 375 px).
Done: signed-in screenshots for all 3 pages at 375/1280; :3010 Cleaning click (planted row 999000001 decided yes, persisted); broader flag rule reviewed and run read-only over the catalog (8 flagged, all via "booking", matching Owen); token surfaces 0 apart from L1; clone suite 1988 passed + 1 todo; Arkitect 5/5.
Remaining:
- "Not cleaning" UI click untested: the planted row was used up by Cleaning. It needs a re-plant on qa_envato.
- L1: option (a) after QA (Owen restarts :3000 without the token, clears the cache). Then re-check that the cache count is 0.
- L2: add an overflow-x wrapper for the shortlist table (Owen).
- I4: the envato-picker-admin checkpoint has no sync command recorded.
- QA setup teardown per envato-picker-admin.md "QA setup: REMOVE BEFORE HANDOFF" (Owen). My clone /workspace/freeplug-qa/envato-picker-qa/clone can be deleted.

## Recheck @ 28159aa (Mon Oct 12 2026, ~1:25 PM CT)
Report: /workspace/freeplug-qa/envato-picker-qa/REPORT-28159aa.md. Overall PASS: 0 High, 0 Medium, 1 Low, 4 Info.
- The token-cache Low is FIXED: count 0 everywhere checked, and :3000's env has no token. The 375 table overflow Low is FIXED for the shortlist and digest.
- New Low: the Needs Lina list (flex rows, not a table) is 451 px wide at 375 px, so the decision buttons are partly off-screen.
- Done: "Not cleaning" on :3010 row 999000002 (stored 'no', tag removed, persists). :3000 Needs Lina shows exactly Owen's 8 (not clicked). Run-2 counts intact. Clone tests 1991 passed.
Remaining:
- Owen: L1 Needs Lina mobile layout.
- Optional: drop ENVATO_API_TOKEN from the box-wide sandbox env (it's inherited by :3001 and others).
- Widen-log table only verified in code (no rows).
- QA teardown per envato-picker-admin.md (the planted rows on qa_envato are now both decided). Clone can be deleted.

## QA @ fa98996 (WIP, local only) (Mon Oct 12 2026, ~11:15 PM CT)
Report: /workspace/freeplug-qa/envato-picker-qa/REPORT-fa98996.md. Overall PASS: 0 High, 0 Medium, 0 Low, 3 Info.
- Diff touches only admin/templates/page.tsx: Needs Lina stacks on mobile, plus a "Manual sync only" disabled button when no token is set.
- The 28159aa L1 is FIXED: Needs Lina at 375 is scrollWidth 375 (was 451). Shortlist and digest are still in ScrollX with a sticky name column.
- Counts are unchanged: 125/23/19, 8 Needs Lina (all booking).
- Tests 1991 passed + 1 todo. gitleaks clean. Token 0 in the dev .next, browser, and process env.
- How the server ran: private clone clone-fa98996, :3050 (stopped), against local Supabase 54321.
  It MUST also unset SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, STRIPE_*, and RESEND_API_KEY. The box env carries live values that override .env.local (I1).
- Arkitect `next build` cached the token in .next/cache (I2). I shredded it; .next was removed from the clone.
Remaining: Owen to commit or squash the WIP. The clones (clone, clone-fa98996) can be deleted. The earlier QA teardown items still stand.
