# Checkpoint: envato-picker-client (Owen, Oct 12 2026, 11:30 PM CT). LOCAL ONLY: not pushed, merged, or deployed.

- Worktree /workspace/owen/envato-picker-client-wt, branch envato-picker-client cut from fa98996 (envato-picker-admin).
- Commits: eb89372 migration | f540cb6 server action + admin lock | f928ab5 UI + copy (HEAD).
- Migration: supabase/migrations/20261012180000_website_requests_template_pick.sql (applied twice to local Docker supabase_db_owen-ladder-local; idempotent).
  Columns business_type / template_choice / envato_item_id / pasted_template_url / template_picked_at / template_locked_at, CHECKs, guard trigger
  (anon/authenticated cannot set or change them: 42501). No new policy, no status values, no license fields.
- DB checks: /workspace/owen/template-pick-pgtest/checks.sql (rolled-back txn) -> 27/27 PASS (run-output.txt).
- Editable rule: status in (submitted, in_review) AND template_locked_at IS NULL; closed never. Lock = admin "Lock pick" at /admin/templates/picks.
- Review server: http://localhost:3011 (next dev, log /workspace/owen/next-3011.log). QA login: qa-picker-login.md (chmod 600).
- Picker path: /dashboard/requests/<request id>/template (Template card on /dashboard/request-website). Spanish: ?lang=es (NEXT_PUBLIC_FREEPLUG_I18N_ES=true locally).

## Known / open
- ALL local cleaning items (459 active) were last synced 2026-10-12 1:06 PM CT, > 6 h ago, so every catalog card shows "Not available" and catalog picks are
  refused as stale. A sync needs the live Envato API (not run). Team pick and pasted link work end to end.
- Copy without a Sable line (Lina's wording, ES draft): card heading/Choose a template/Change/72 After will pick/Not available/Retry/Back/Continue bar.
  picker.empty says "Try All types" but there's no All types filter in the design. picker.confirm.body still "[ask Cheke]".
- "Change business type" only shows until business_type is saved (spec: saved with the pick only when empty). Confirm with Aria/Lina.
- Widen exception accepts a widen log row for the request's type that names this request, or a team widen with no request id (admin "Widen to general").
- No customer-side widen UI (spec only covers the server check).

## Round 2 (Oct 12, ~11:40 PM CT)
- Commits: af5308b (widen = general only; changeBusinessType) | b8d7317 (UI: change type always, type-cleared banner, Show more x12, Sable 11:30 PM keys) | bdfe479 (scripts/clean-env.sh). HEAD bdfe479.
- pgtest: 51/51 PASS (adds INSERT+UPDATE per column: owner refused 42501, service_role allowed). Migration unchanged (guard already covered all six on INSERT and UPDATE).
- "General" (customer side) = auto_niches empty or only other_local. The admin "general" view lists ALL fresh items with no niche filter: narrower here on purpose (Aria). Locally 4,691 active items are general; 0 carry other_local.
- LOCAL bump done (STALE-TEST-DONE present, CATALOG-TESTS-DONE absent): envato_items.last_seen_at = now() on 12,651 active rows at ~11:38 PM CT. Cleaning cards are available until ~5:38 AM CT. No Envato sync run.

## Round 3: fix round from Vera's REPORT-client-f928ab5 + Jace additions (Oct 12, ~11:45 PM to 12:05 AM CT)
- Envato re-sync (Aria-approved, ran once via scripts/clean-env.sh, token from /workspace/owen/secrets/envato.env, 2.5 s pacing, local DB only): run 3, complete=true, error=null, 0 errors, 312 calls, 12,657 seen, 131 changed, 1 removed, ~10 min. Log: /workspace/owen/envato-sync-run.log. (A first launch at ~11:44 PM died on module resolution before any API call; nothing was sent.)
- Token match-only scan of every .next/cache dir on the box (10 dirs): 0 hits.
- 4097c217 notes: 'qa-guard-probe' -> NULL (no history of an earlier value exists; updated_at left as it was).
- Commit 41a6dd9 (HEAD; base bdfe479):
  - M1: when a widen applies (client widen for this request, or team widen for the type), the grid lists general templates AFTER the niche cards with a gray "General" tag (picker.card.general / .aria), and the widen id goes with the catalog pick.
  - M2: the ES flag accepts 'true' or 'on'.
  - L1: the type-cleared banner uses a per-request httpOnly cookie, set when a change clears the pick and deleted on a successful save; ?repick=1 still works.
  - L2: fixed titles picker.confirm.title.link / .teampick. Catalog picks keep {name}.
  - L3 (Jace): other_local lists every general template with no General tag, and the server accepts general items for other_local.
  - Non-owner, anonymous or bad id: a real 404 from the new layout.tsx gate, which sits outside loading.tsx.
  - Show more moves focus to the first new card. The .rest aria is used when fewer than 12 are left, and the button hides at the end.
- Tests: 2082 passed + 1 todo (163 files). tsc clean (outside generated .next types). eslint clean. gitleaks: bdfe479..41a6dd9 and src have no leaks.
- Arkitect: diagnose_repository run before the changes. verify_codebase ran after but the MCP call timed out without returning a result (no report written).
- :3011 restarted on 41a6dd9 through clean-env (log /workspace/owen/next-3011.log).
