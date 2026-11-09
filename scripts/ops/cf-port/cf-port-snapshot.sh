#!/bin/bash
unset SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY CLOUDFLARE_API_TOKEN STRIPE_WEBHOOK_SECRET  # bot secrets: never inherited (Oct 3 audit)
# Read-only snapshot of /workspace/freeplug-cf-port vs 9345ae0 (temp index copy; the port's index is never written).
# Usage: cf-port-snapshot.sh OUTFILE
set -euo pipefail
export GIT_OPTIONAL_LOCKS=0
OUT="$1"
cd /workspace/freeplug-cf-port
TMPIDX=$(mktemp /tmp/owen-cfport-index.XXXXXX)
trap 'rm -f "$TMPIDX"' EXIT
cp "$(git rev-parse --git-path index)" "$TMPIDX"
EXCL=(":(exclude,glob)**/node_modules/**" ":(exclude,glob)**/.env*" ":(exclude,glob)**/.dev.vars*" ":(exclude,glob)**/.next/**" ":(exclude,glob)**/.open-next/**" ":(exclude,glob)**/.wrangler/**")
git ls-files --others --exclude-standard -z -- . "${EXCL[@]}" | GIT_INDEX_FILE="$TMPIDX" xargs -0 -r git add -N --
GIT_INDEX_FILE="$TMPIDX" git diff --binary --full-index 9345ae0 -- . "${EXCL[@]}" > "$OUT"
