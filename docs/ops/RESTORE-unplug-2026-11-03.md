# Restore freeplug-in.dev (unplugged 2026-11-03 ~4:10 PM CT)
Removed: Worker Custom Domains freeplug-in.dev and www.freeplug-in.dev (service "freeplug", env production).
Nothing else changed. No worker routes existed. workers.dev for "freeplug" was already disabled (left as is).

## Reattach (pick one)
A) Dashboard: Workers & Pages > freeplug > Settings > Domains & Routes > Add > Custom domain: freeplug-in.dev, then www.freeplug-in.dev.
B) API (for each hostname):
  curl -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains \
    -d '{"hostname":"freeplug-in.dev","service":"freeplug","environment":"production","zone_id":"'$ZONE_ID'"}'
  (repeat with "www.freeplug-in.dev"). Account/zone IDs are in backup.json.
C) Add to wrangler.jsonc: "routes":[{"pattern":"freeplug-in.dev","custom_domain":true},{"pattern":"www.freeplug-in.dev","custom_domain":true}] and deploy.
Cloudflare auto-recreates the DNS records + cert; allow a few minutes.
