#!/bin/bash
set -euo pipefail
cd /workspace/owen/golive-wt
git fetch -q origin main
git checkout -q --detach origin/main
git log --oneline -1
cd freeplug-landing
ACC=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"][0]["id"])')
cp wrangler.jsonc /workspace/owen/filter-golive-wrangler.jsonc.bak
trap 'cp /workspace/owen/filter-golive-wrangler.jsonc.bak wrangler.jsonc; echo restored' EXIT
sed -i "s/REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID/$ACC/" wrangler.jsonc
python3 - <<'PY'
p='wrangler.jsonc'
s=open(p).read()
old='"MERCH_PERSONAL_DOWNLOAD_ENABLED": "true"'
assert s.count(old)==1, s.count(old)
s=s.replace(old,old+',\n    "MERCH_SHIRTS_ENABLED": "true",\n    "PRINTIFY_SHOP_ID": "29664778",\n    "MERCH_COLLECTIONS_ENABLED": "true",\n    "MERCH_SHOP_ENABLED": "true",\n    "NEXT_PUBLIC_MERCH_SHOP_ENABLED": "true",\n    "MERCH_CUSTOM_AUTOSEND_ENABLED": "false"')
open(p,'w').write(s)
# verify
for k in ['MERCH_SHOP_ENABLED','NEXT_PUBLIC_MERCH_SHOP_ENABLED','MERCH_CHECKOUT_ENABLED','MERCH_CUSTOM_AUTOSEND_ENABLED']:
    import re
    m=re.search(rf'"{k}"\s*:\s*"([^"]*)"', open(p).read())
    print(f'flag {k}={m.group(1) if m else "MISSING"}')
PY
# Ensure esbuild available for OpenNext (no-save, matches prior deploys)
npm install esbuild --no-save --no-fund --no-audit >/tmp/filter-golive-esbuild-install.log 2>&1 || true
ANON="$SUPABASE_LIVE_ANON_KEY"
UPLOAD_LOG=/workspace/owen/filter-golive-upload.log
env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_ACCESS_TOKEN -u SUPABASE_DB_PASSWORD -u SUPABASE_LIVE_ANON_KEY \
 -u STRIPE_LIVE_CHECKOUT_RK -u STRIPE_LIVE_RK -u STRIPE_LIVE_RK_NEW -u STRIPE_LIVE_WHSEC -u STRIPE_PREVIEW_KEY -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET \
 -u RESEND_API_KEY -u SMTP_PASS -u CALCOM_API_KEY -u HUNTER_API_KEY -u NAMECHEAP_API_KEY -u VULTR_API_KEY -u TWITTER_BEARER_TOKEN -u IMPACT_AUTH_TOKEN -u CWS_CLIENT_SECRET -u KB_KEYSTORE_PASSWORD -u PRINTIFY_API_TOKEN \
 NEXT_PUBLIC_APP_URL=https://freeplug-in.dev NEXT_PUBLIC_SUPABASE_URL=https://ldlyjoybppmwvvcarewq.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" NEXT_PUBLIC_FREEPLUG_I18N_ES=on NEXT_PUBLIC_MERCH_SHOP_ENABLED=true MERCH_SHOP_ENABLED=true MERCH_CHECKOUT_ENABLED=true MERCH_CUSTOM_AUTOSEND_ENABLED=false \
 npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes 2>&1 | tee "$UPLOAD_LOG"
VID=$(python3 - <<'PY'
import re
log=open('/workspace/owen/filter-golive-upload.log').read()
m=re.findall(r'Worker Version ID:\s*([0-9a-f-]{36})', log)
assert m, 'no Worker Version ID in upload log'
print(m[-1])
PY
)
echo "=== uploaded version: $VID"
echo "=== deploying $VID @100%"
env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN npx wrangler versions deploy "${VID}@100%" --yes 2>&1 | tee /workspace/owen/filter-golive-versions-deploy.log
sleep 3
ROLLBACK=ae6d49bf-46b5-45b0-ab83-964147b4264b
BAD=0
for p in / /es /merch/all /es/merch/all /merch /shop /es/shop /shop/unisex-heavy-blend-crewneck-sweatshirt-49 /es/shop/mug-11oz-68 /api/merch/shop/cap; do
  c=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "https://freeplug-in.dev$p" || true); echo "live $p $c"
  case "$c" in 5*|000) BAD=1;; esac
done
if [ "$BAD" = 1 ]; then
  echo "=== 5xx: ROLLING BACK to $ROLLBACK"
  mkdir -p /tmp/rb
  (cd /tmp/rb && env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN CLOUDFLARE_ACCOUNT_ID=$ACC /workspace/owen/golive-wt/freeplug-landing/node_modules/.bin/wrangler versions deploy "${ROLLBACK}@100%" --name freeplug --yes 2>&1 | tee /workspace/owen/filter-golive-rollback.log | grep -E "SUCCESS|ERROR")
  for p in / /shop /merch/all; do echo "after rollback $p $(curl -s -o /dev/null -w '%{http_code}' https://freeplug-in.dev$p)"; done
  echo "ROLLED_BACK=1 DEPLOYED_VERSION=$ROLLBACK"
  exit 2
fi
echo "=== versions list (tail)"
env -u __CURSOR_SANDBOX_ENV_RESTORE npx wrangler versions list 2>&1 | tee /workspace/owen/filter-golive-versions-list.log | tail -40
echo "DEPLOYED_VERSION=$VID"
echo "MERGE_COMMIT=$(git -C /workspace/owen/golive-wt rev-parse HEAD)"
date
