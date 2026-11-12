# Ops scripts and restore notes

Copied from the box on 2026-11-09 (`/workspace/owen/*.sh|*.mjs|*.py`, `/workspace/owen/i18n-tools/`,
`/workspace/owen/freeplug-unplug-2026-11-03/RESTORE.md`, `/workspace/freeplug-backup-2026-11-02/RESTORE.md`,
`/workspace/{build-freeplug-plan.py,check-freeplug-links.py,freeplug-plan.md}`).

Scripts live in `scripts/ops/` (deploy, cf-port, verify, i18n, planning). They are history and
reference: they expect box paths and read secrets from the environment. Do not run a deploy
script without Cheke's OK. The 39 MB git bundle backup is not in git.
