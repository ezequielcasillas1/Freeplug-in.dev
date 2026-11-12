#!/bin/bash
set -euo pipefail
cd /workspace/owen/golive-wt/freeplug-landing
ACC=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"][0]["id"])')
cp wrangler.jsonc /workspace/owen/preflight-wrangler.jsonc.bak
trap 'cp /workspace/owen/preflight-wrangler.jsonc.bak wrangler.jsonc; pkill -f "wrangler dev --port 8799" || true; rm -f .dev.vars; echo restored' EXIT
sed -i "s/REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID/$ACC/" wrangler.jsonc
python3 - <<'PY'
p='wrangler.jsonc';s=open(p).read()
old='"MERCH_PERSONAL_DOWNLOAD_ENABLED": "true"'
assert s.count(old)==1
s=s.replace(old,old+',\n    "MERCH_SHIRTS_ENABLED": "true",\n    "PRINTIFY_SHOP_ID": "29664778",\n    "MERCH_COLLECTIONS_ENABLED": "true",\n    "MERCH_SHOP_ENABLED": "true",\n    "NEXT_PUBLIC_MERCH_SHOP_ENABLED": "true",\n    "MERCH_CUSTOM_AUTOSEND_ENABLED": "false"')
open(p,'w').write(s)
PY
ANON="$SUPABASE_LIVE_ANON_KEY"
rm -f .dev.vars
if [ "${SKIP_BUILD:-0}" != 1 ]; then rm -rf .next .open-next
env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_ACCESS_TOKEN -u SUPABASE_DB_PASSWORD -u SUPABASE_LIVE_ANON_KEY \
 -u STRIPE_LIVE_CHECKOUT_RK -u STRIPE_LIVE_RK -u STRIPE_LIVE_RK_NEW -u STRIPE_LIVE_WHSEC -u STRIPE_PREVIEW_KEY -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET \
 -u RESEND_API_KEY -u SMTP_PASS -u CALCOM_API_KEY -u HUNTER_API_KEY -u NAMECHEAP_API_KEY -u VULTR_API_KEY -u TWITTER_BEARER_TOKEN -u IMPACT_AUTH_TOKEN -u CWS_CLIENT_SECRET -u KB_KEYSTORE_PASSWORD -u PRINTIFY_API_TOKEN \
 NEXT_PUBLIC_APP_URL=https://freeplug-in.dev NEXT_PUBLIC_SUPABASE_URL=https://ldlyjoybppmwvvcarewq.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" NEXT_PUBLIC_FREEPLUG_I18N_ES=on NEXT_PUBLIC_MERCH_SHOP_ENABLED=true MERCH_SHOP_ENABLED=true MERCH_CHECKOUT_ENABLED=true MERCH_CUSTOM_AUTOSEND_ENABLED=false \
 npx opennextjs-cloudflare build > /workspace/owen/preflight-build.log 2>&1
fi
echo "build ok"; grep -E "Next.js version|opennextjs/cloudflare version" /workspace/owen/preflight-build.log
(umask 077; python3 -c "import os;open('.dev.vars','w').write('NEXT_PUBLIC_SUPABASE_URL=https://ldlyjoybppmwvvcarewq.supabase.co\nSUPABASE_SERVICE_ROLE_KEY='+os.environ['SUPABASE_SERVICE_ROLE_KEY']+'\n')")
# Local preview: only the Supabase URL + service role (for the upload route) and the Cloudflare token (remote AI binding) reach the worker.
env -u __CURSOR_SANDBOX_ENV_RESTORE -u ENVATO_API_TOKEN -u SUPABASE_ACCESS_TOKEN -u SUPABASE_DB_PASSWORD -u SUPABASE_LIVE_ANON_KEY \
 -u STRIPE_LIVE_CHECKOUT_RK -u STRIPE_LIVE_RK -u STRIPE_LIVE_RK_NEW -u STRIPE_LIVE_WHSEC -u STRIPE_PREVIEW_KEY -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET \
 -u RESEND_API_KEY -u SMTP_PASS -u CALCOM_API_KEY -u HUNTER_API_KEY -u NAMECHEAP_API_KEY -u VULTR_API_KEY -u TWITTER_BEARER_TOKEN -u IMPACT_AUTH_TOKEN -u CWS_CLIENT_SECRET -u KB_KEYSTORE_PASSWORD -u PRINTIFY_API_TOKEN -u PGDATABASE \
 npx wrangler dev --port 8799 --ip 127.0.0.1 > /workspace/owen/preflight-wdev.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8799/ && break; sleep 2; done
B=http://127.0.0.1:8799
for p in / /es /merch /es/merch /merch/all /es/merch/all /shop /es/shop /shop/unisex-heavy-blend-crewneck-sweatshirt-49 /es/shop/mug-11oz-68 /merch/drinkware /merch/t-shirts /api/merch/shop/cap; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' $B$p)"; done
echo "nav en=$(curl -s $B/ | grep -cE 'href="/shop"[^>]*>Shop<') es=$(curl -s $B/es | grep -cE 'href="/es/shop"[^>]*>Tienda<')"
echo "all-merch en cards=$(curl -s $B/merch/all | grep -o 'data-testid="all-merch"' | wc -l) h1=$(curl -s $B/merch/all | grep -o '<h1[^>]*>[^<]*' | sed 's/.*>//') links=$(curl -s $B/merch/all | grep -oE 'href="/(shop|merch)/[a-z0-9/-]+"' | sort -u | wc -l)"
echo "all-merch es h1=$(curl -s $B/es/merch/all | grep -o '<h1[^>]*>[^<]*' | sed 's/.*>//') links=$(curl -s $B/es/merch/all | grep -oE 'href="/es/(shop|merch)/[a-z0-9/-]+"' | sort -u | wc -l)"
echo "merch landing link en=$(curl -s $B/merch | grep -c 'href="/merch/all"') es=$(curl -s $B/es/merch | grep -c 'href="/es/merch/all"')"
grep -E "wrangler:error|Error:" /workspace/owen/preflight-wdev.log | head -5 || true
