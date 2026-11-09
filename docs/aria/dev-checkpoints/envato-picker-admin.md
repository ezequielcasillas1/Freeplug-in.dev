# envato-picker-admin checkpoint

## Arkitect structure check (BEFORE changes): 12:06 PM CT, user-arkitect-clean diagnose_repository on /workspace/freeplug-ladder
- Current architecture: modular-monolith (confidence 0.9). Recommended: keep the modular monolith (triple: modular-monolith / screaming-architecture / clean-architecture edge, remix uncle-bob-special).
- Repo health: unknown (0.48). Arkitect reports hasGit:false (it doesn't detect the .git file of a worktree root) and mis-detects the platform as desktop.
- Blockers: none. No restructure is recommended; autoRefactor is off. Warning: avoid Singleton overuse in service layers.
- Plan: add the picker as a feature module (src/lib/envato/* adapter behind an interface, src/app/admin/templates/* UI, plus one migration).

## Status: 12:38 PM CT, Mon Oct 12 2026
- Branch: envato-picker-admin (LOCAL ONLY, not pushed; pushing waits for Cheke's GitHub sign-in and his yes).
  Worktree /workspace/owen/envato-picker-wt, app in freeplug-landing.
  Base: change-requests (f186a7f) + merge of ladder-fix-2026-10-03 (clean) = f5a0f2a. Phase 1 commit: d5fca60.
- Gates at d5fca60: vitest 155 files / 1956 passed + 1 todo (phase-2 dedupe stub); tsc ok; eslint 0 errors
  (1 old warning in faq/page.tsx); next build ok; gitleaks (staged) no leaks; Arkitect verify_codebase 5/5 PASS
  (/workspace/owen/arkitect-reports/verify-2026-10-12T12-21-00-05-00.md); backup
  /workspace/backups/envato-picker-admin-20261012-1222-d5fca60.tar.gz (git archive, no .env*).
- Migration 20261012170000_envato_catalog.sql applied to the LOCAL Docker DB only (re-applied once: idempotent).
  Live RLS check scripts/envato-rls-check.mjs: anon + authenticated get permission denied on select/insert/update/delete
  of all 5 tables; service_role reads.
- Shortlist seeded from /workspace/lina/envato-shortlist-2026-10-12.json: 167 picks = 125 confirmed / 23 cut /
  19 unverified (re-imported twice, still 167 rows).
- First full sync (run 1, 12:18-12:31 PM CT, token worked): complete, 312 calls, 12,651 items, 0 removed, 12 partitions
  (only site-templates/corporate/business split: $0-15 2,084 / $16-20 2,436 / $21+ 1,522). Extended prices fetched for
  shortlist items: 153 of 167 rows have one (the rest: Envato returns only a Regular licence for those items).
  Cleaning-tagged: 459. Needs Lina (hotel-style housekeeping): 0 in these 10 categories.
- Done: everything in the 12:05 GO (pages, filters, widen log, digest, Needs Lina, cron written but off, token tests).

## Ports
- :3000 = picker worktree, next dev bound to 127.0.0.1 (log /workspace/owen/devserver-3000-envato.log).
  URLs: http://localhost:3000/admin/templates , /admin/templates/widen-log , /admin/templates/digest
- :3001 = i18n-es (see i18n-es.md). Local Supabase 54321/54322.
- Start: $P /workspace/owen/devstack/start-next.sh /workspace/owen/envato-picker-wt/freeplug-landing /workspace/owen/devserver-3000-envato.log 3000 127.0.0.1 &
- Stop: /workspace/owen/devstack/stop-all.sh --next-only --worktree=/workspace/owen/envato-picker-wt/freeplug-landing

## Exact next step
Lina reviews /admin/templates on localhost:3000 (sign in as an ADMIN_EMAILS user). Vera runs her checks. Then Cheke decides
the push order (the base stack is unpushed) and the Envato app registration (OAuth vs personal token).

## Update 12:50 PM CT: hotel flag (Aria + Jace ruling 12:40 PM)
- Read-only count BEFORE the change (local catalog, active items): 8 templates have a whole-word term from
  {house cleaning, maid service, housekeeping, cleaning service, home cleaning, janitorial} plus a whole-word
  {hotel, hostel, resort, motel, booking} tag. All 8 match on "booking".
- Commit eb532a7 (on envato-picker-admin, local only): new Needs Lina rule; flagged items keep the cleaning tag until Lina
  decides. 1988 tests passed + 1 todo; tsc, lint (0 errors), build, gitleaks all ok.
- The live catalog rows are NOT re-tagged yet (no re-sync). The next sync would put 8 in Needs Lina (the cleaning-tagged
  total stays 459). :3000 shows Needs Lina (0) until then.
- The hotelflag side branch (583ee94) was deleted locally, never pushed.
- Token: git log -p change-requests..HEAD has 0 hits for the token value; all refs 0; gitleaks no leaks. The token has gone
  only to api.envato.com (Authorization header, during the sync). Nothing has been pushed.
  .next is gitignored (freeplug-landing/.gitignore:17). Turbopack's dev cache re-writes the token into
  .next/dev/cache/turbopack/*.sst whenever next dev runs with ENVATO_API_TOKEN in its env (1 file on :3000 after restart).
  :3010 runs WITHOUT the token and has 0. Fix options for Cheke/Aria: run :3000 without the token except during a
  sync, or turn off the Turbopack dev filesystem cache.
- Backups: envato-picker-admin-20261012-1246-eb532a7.tar.gz (git archive: no .next, no .env*, 0 token hits). The d5fca60 tar
  also has no .next. /workspace/owen/backup-worktrees.sh already excludes .next, node_modules and .env*.

## Ports (12:50 PM CT)
- :3000 picker (eb532a7), 127.0.0.1 only, real local catalog. :3001 i18n-es. :3010 QA copy (see below), 127.0.0.1 only.

## QA setup: REMOVE BEFORE HANDOFF (local only, nothing committed)
What exists:
- Local auth user vera-qa@example.test (local Supabase 54321). Login: /workspace/aria/dev-checkpoints/qa-envato-login.md (0600).
- vera-qa@example.test added to ADMIN_EMAILS in /workspace/owen/envato-picker-wt/freeplug-landing/.env.local
  (the pre-QA copy is /workspace/owen/qa-envato/picker-env.local.before-qa).
- DB qa_envato (a copy of the 5 picker tables inside the local Docker Postgres) with planted row id 999000001
  ("QA PLANT - Seaside Hotel Housekeeping"). The main local DB has no plant.
- Container qa_envato_rest (PostgREST on 127.0.0.1:54331); proxy /workspace/owen/qa-envato/proxy.mjs on 127.0.0.1:54340.
- Worktree /workspace/owen/envato-qa-wt (detached at eb532a7) with Next on 127.0.0.1:3010. Log: /workspace/owen/devserver-3010-envato-qa.log.
Remove (in this order):
    P="env -u PGDATABASE -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_PASSWORD -u RESEND_API_KEY -u SMTP_PASS -u CLOUDFLARE_API_TOKEN -u __CURSOR_SANDBOX_ENV_RESTORE"
    # 1. stop :3010 Next (by its listener's process group)
    PID=$(ss -Hltnp 'sport = :3010' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1); kill -TERM -- -$(ps -o pgid= -p $PID | tr -d ' ')
    # 2. stop the proxy and the QA PostgREST
    pkill -f /workspace/owen/qa-envato/proxy.mjs; docker rm -f qa_envato_rest
    # 3. drop the QA database
    docker exec supabase_db_owen-ladder-local psql -U postgres -c 'drop database qa_envato'
    # 4. remove the worktree (its .env.local goes with it)
    cd /workspace/freeplug-ladder && shred -u /workspace/owen/envato-qa-wt/freeplug-landing/.env.local; git worktree remove --force /workspace/owen/envato-qa-wt
    # 5. delete the QA auth user
    $P node /workspace/owen/qa-envato/qa-user.mjs --delete
    # 6. take vera-qa out of ADMIN_EMAILS on :3000, then restart :3000
    cp -p /workspace/owen/qa-envato/picker-env.local.before-qa /workspace/owen/envato-picker-wt/freeplug-landing/.env.local
    /workspace/owen/devstack/stop-all.sh --next-only --worktree=/workspace/owen/envato-picker-wt/freeplug-landing
    $P /workspace/owen/devstack/start-next.sh /workspace/owen/envato-picker-wt/freeplug-landing /workspace/owen/devserver-3000-envato.log 3000 127.0.0.1 &
    # 7. shred the login file and cookies
    shred -u /workspace/aria/dev-checkpoints/qa-envato-login.md /workspace/owen/qa-envato/cookies-vera.txt /workspace/owen/qa-envato/picker-env.local.before-qa

## Update 1:17 PM CT: token off :3000, second sync, 375 scroll box
- Commit 28159aa (local only): the shortlist, widen-log and digest tables scroll inside an overflow-x-auto box (ScrollX)
  with a right-edge fade, and the name column is sticky with an opaque background. Gates: 1991 tests passed + 1 todo;
  tsc, lint (0 errors), build and gitleaks ok; 0 token hits in git log -p. Arkitect verify_codebase 5/5 PASS at
  28159aa (/workspace/owen/arkitect-reports/verify-2026-10-12T13-00-50-05-00.md; the MCP call timed out, the report was
  still written). Backup /workspace/backups/envato-picker-admin-20261012-1300-28159aa.tar.gz (no .next, no .env*, 0 token).
- Token (Jace option a): it was never in .env.local; it came from the box shell env. It now lives in
  /workspace/owen/secrets/envato.env (dir 700, file 600). Next on :3000 starts with -u ENVATO_API_TOKEN, so "Sync now"
  on the page reports no-token by design. Use the manual command below.
- Run 2 (1:01-1:14 PM CT): complete, 312 calls, 12,651 seen, 75 changed, 0 removed. Needs Lina on :3000 = 8.

## Manual sync command (loads the token for that one process only)
    env -u PGDATABASE -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_PASSWORD -u RESEND_API_KEY -u SMTP_PASS -u CLOUDFLARE_API_TOKEN -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN /workspace/owen/envato-sync/run-sync.sh [LOGFILE]
  The script bundles scripts/envato-sync-local.ts to /workspace/owen/envato-sync/sync.mjs (outside the repo and .next),
  sources secrets/envato.env with set -a (never on a command line), and execs node. It refuses a non-local Supabase.
  It takes about 13 min at 2.5 s/call. Log default: /workspace/owen/envato-sync/sync-YYYYMMDD-HHMM.log.

## :3000 start (no token)
    env -u PGDATABASE -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_PASSWORD -u RESEND_API_KEY -u SMTP_PASS -u CLOUDFLARE_API_TOKEN -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN /workspace/owen/devstack/start-next.sh /workspace/owen/envato-picker-wt/freeplug-landing /workspace/owen/devserver-3000-envato.log 3000 127.0.0.1 &

## QA additions
- qa_envato also has planted row 999000002 ("QA PLANT 2 - Resort Booking Cleaning Service") for Vera's Not cleaning click.
  Dropping qa_envato (removal step 3) removes it. Row 999000001 already has Vera's "yes" decision (17:52 UTC).

## Oct 12, 2026, 6:05 PM CT (Owen)
- WIP commit fa98996 on envato-picker-admin (parent 28159aa): "WIP: 375 Needs Lina stack + manual sync only label (unverified by QA)". tsc 0 errors, eslint clean on admin/templates, vitest 1991 passed / 1 todo. Not pushed. Not QA-verified.
- D1 move (Aria's spec, last section of /workspace/aria/envato-picker-prebuild.md): NOT started. Parked for auth-rate-limit.
- Rule: every dev server starts with `env -u ENVATO_API_TOKEN` (full env -u prefix). Never put the Envato token on a command line or in a temp file.
