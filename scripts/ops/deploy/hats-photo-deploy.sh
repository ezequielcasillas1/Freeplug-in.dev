#!/bin/bash
set -euo pipefail
cd /workspace/owen/plans-fix-wt
git fetch origin cursor/merch-collections-printify-0466
git checkout -q --detach 9a53654
git log --oneline -1
cd freeplug-landing
ACC=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"][0]["id"])')
cp wrangler.jsonc /workspace/owen/hats-photo-wrangler.jsonc.bak
trap 'cp /workspace/owen/hats-photo-wrangler.jsonc.bak wrangler.jsonc; echo restored' EXIT
sed -i "s/REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID/$ACC/" wrangler.jsonc
python3 - <<'PY'
p='wrangler.jsonc';s=open(p).read()
old='"MERCH_PERSONAL_DOWNLOAD_ENABLED": "true"'
assert s.count(old)==1
s=s.replace(old,old+',\n    "MERCH_SHIRTS_ENABLED": "true",\n    "PRINTIFY_SHOP_ID": "29664778",\n    "MERCH_COLLECTIONS_ENABLED": "true"')
open(p,'w').write(s)
PY
# Ensure esbuild available for OpenNext (no-save, matches prior deploys)
npm install esbuild --no-save --no-fund --no-audit >/tmp/hats-esbuild-install.log 2>&1 || true
ANON="$SUPABASE_LIVE_ANON_KEY"
UPLOAD_LOG=/workspace/owen/hats-photo-upload.log
env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_ACCESS_TOKEN -u SUPABASE_DB_PASSWORD -u SUPABASE_LIVE_ANON_KEY \
 -u STRIPE_LIVE_CHECKOUT_RK -u STRIPE_LIVE_RK -u STRIPE_LIVE_RK_NEW -u STRIPE_LIVE_WHSEC -u STRIPE_PREVIEW_KEY -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET \
 -u RESEND_API_KEY -u SMTP_PASS -u CALCOM_API_KEY -u HUNTER_API_KEY -u NAMECHEAP_API_KEY -u VULTR_API_KEY -u TWITTER_BEARER_TOKEN -u IMPACT_AUTH_TOKEN -u CWS_CLIENT_SECRET -u KB_KEYSTORE_PASSWORD -u PRINTIFY_API_TOKEN \
 NEXT_PUBLIC_APP_URL=https://freeplug-in.dev NEXT_PUBLIC_SUPABASE_URL=https://ldlyjoybppmwvvcarewq.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" NEXT_PUBLIC_FREEPLUG_I18N_ES=on \
 npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes 2>&1 | tee "$UPLOAD_LOG"
VID=$(python3 - <<'PY'
import re
log=open('/workspace/owen/hats-photo-upload.log').read()
m=re.findall(r'Worker Version ID:\s*([0-9a-f-]{36})', log)
assert m, 'no Worker Version ID in upload log'
print(m[-1])
PY
)
echo "=== uploaded version: $VID"
echo "=== deploying $VID @100%"
env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN npx wrangler versions deploy "${VID}@100%" --yes 2>&1 | tee /workspace/owen/hats-photo-versions-deploy.log
echo "=== versions list (tail)"
env -u __CURSOR_SANDBOX_ENV_RESTORE npx wrangler versions list 2>&1 | tee /workspace/owen/hats-photo-versions-list.log | tail -40
echo "DEPLOYED_VERSION=$VID"
