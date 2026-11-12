# Printify custom integration — publish handshake (tees 36–41)

After deploy, call **publishing_succeeded** once per product (do not run until live URLs work).

```bash
SHOP_ID=29664778
BASE=https://freeplug-in.dev
# Authorization: Bearer $PRINTIFY_API_TOKEN

curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/6af5cb568f606d53210f23c1/publishing_succeeded.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external":{"id":"36-stand-144000-crest","handle":"'$BASE'/merch/t-shirts/36-stand-144000-crest"}}'

curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/6af5cb7e2671251aea09ebc3/publishing_succeeded.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external":{"id":"37-stand-144000-stencil","handle":"'$BASE'/merch/t-shirts/37-stand-144000-stencil"}}'

curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/6af5cb87f779aa77dc064800/publishing_succeeded.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external":{"id":"38-stand-144000-blend","handle":"'$BASE'/merch/t-shirts/38-stand-144000-blend"}}'

curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/6af5cb90a562f9679a04ce17/publishing_succeeded.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external":{"id":"39-knock-doors-left-chest","handle":"'$BASE'/merch/t-shirts/39-knock-doors-left-chest"}}'

curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/6af5cb96dda407dd0f042750/publishing_succeeded.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external":{"id":"40-knock-doors-centered","handle":"'$BASE'/merch/t-shirts/40-knock-doors-centered"}}'

curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/6af5cba1f61d84659e0f6db0/publishing_succeeded.json" \
  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"external":{"id":"41-knock-doors-front-back","handle":"'$BASE'/merch/t-shirts/41-knock-doors-front-back"}}'

```

On failure: `POST .../publishing_failed.json` with `{"reason":"..."}`.
