# i18n-es checkpoint (PARKED): Mon Oct 12, 2026, 12:03 PM CT

- Branch: i18n-es. Worktree /workspace/owen/i18n-es-wt, app in freeplug-landing
- HEAD: 258e897 (test: dashboard renders no known English in Spanish; key coverage; NBSP dates)
- Base: origin/FP0.5 (origin/HEAD) at 7fac2bf; 78 commits on the branch. There is no origin/main.
- Tree: clean. .env.local is untracked (ignored by freeplug-landing/.gitignore:40 `.env.*`).
- gitleaks (snapshot config, 7fac2bf..HEAD): 78 commits scanned, no leaks.
- Push status: NOT PUSHED. `git push -u origin i18n-es` failed because the box has no GitHub credentials
  ("could not read Username for https://github.com"). The branch exists only locally.

## Done
- Full dashboard translated to Spanish; 1741 tests passing; Arkitect verify 5/5.

## Ports
- UPDATED 12:21 PM CT: i18n-es now runs on **:3001** (Next dev, pid 1146171, cwd this worktree, same
  .env.local with FREEPLUG_I18N_ES_ALLOW_PENDING=1). Log: /workspace/owen/devserver-3001-i18n.log.
  Checked: http://localhost:3001/ and /es return 200 with Spanish copy (Inicio, Iniciar sesión, Precios).
  Note: .env.local still says NEXT_PUBLIC_APP_URL=http://localhost:3000, so absolute redirects
  (Stripe return, auth emails) point at :3000; change it only if Vera's retest hits those.
- :3000 is now the permanent ADMIN port, serving the envato-picker-admin worktree (bound 127.0.0.1).
- Local Docker Supabase: API 127.0.0.1:54321, DB 54322, Studio 54324. Never use ldlyjoybppmwvvcarewq or ncofgcaxupqwdwjiodzz.

## Open items
1. Sable reviews the 14 new keys: /workspace/owen/i18n-es-notes/dashboard-es-for-sable.md
2. Sable group B, 60 keys (source /workspace/freeplug-qa/i18n-toggle-qa/ES-DRIFT-258e897.md; her pause is noted in
   /workspace/aria/dev-checkpoints/copy-sable.md). NOW READY: /workspace/copy/freeplug-es-drift-groupB-2026-10-12.json
   (the table is in the matching .md). NOT folded in yet. 25 rows are [STRICT] and need a native-speaker sign-off;
   7 rows are [ask Cheke] and need an English decision.
3. Lina's 375px check.
4. Vera's retest of EN->ES, ES->EN and persistence, including a seeded account with a plan.
5. Screenshots for Jacqueline Croissant once Vera passes.

## Exact next step
Fold in Sable's files: the 14 keys plus the group B JSON. Keep the [STRICT] rows pending sign-off and leave the [ask Cheke]
rows open for Cheke. Rerun tests, tsc, lint, gitleaks and verify. It is already served on :3001 for Vera
(restart it with the start command below after folding in). Push i18n-es once credentials are in place.

## Start/stop (from /workspace/owen/devstack/I18N-3000-STACK.md)
Start:
    sudo sh -c 'nohup /usr/sbin/dockerd >/tmp/dockerd.log 2>&1 &'   # only if Docker is down
    cd /workspace/owen/local-supabase && npx supabase start
    P="env -u PGDATABASE -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_PASSWORD -u RESEND_API_KEY -u SMTP_PASS -u CLOUDFLARE_API_TOKEN -u __CURSOR_SANDBOX_ENV_RESTORE"
    $P /workspace/owen/devstack/start-next.sh /workspace/owen/i18n-es-wt/freeplug-landing /workspace/owen/devserver-3001-i18n.log 3001 &
    (start-next.sh args since Oct 12: APP_DIR LOG PORT [BIND])
Stop (:3001; stop-all.sh only handles :3000, so stop by the :3001 listener's process group):
    PID=$(ss -Hltnp 'sport = :3001' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1); kill -TERM -- -$(ps -o pgid= -p $PID | tr -d ' ')
    cd /workspace/owen/local-supabase && npx supabase stop   # only if the DB should go down
