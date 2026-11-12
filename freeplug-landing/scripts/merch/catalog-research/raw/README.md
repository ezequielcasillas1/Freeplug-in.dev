# Printify US catalog raw dump (read-only)

Generated for Freeplug catalog-research. **No products created, updated, or published.**

## Filter

keyword filter applied (see fetch_catalog_us.py USE_KEYWORD_FILTER)

Title keyword regex covered common merch words (tee, hoodie, mug, tote, hat, blanket, etc.).
Blueprints whose titles do not match were skipped to keep the download under the time budget.

## Files

| Path | Description |
|------|-------------|
| `blueprints.json` | Full Printify catalog blueprints list (~3,022) |
| `providers.json` | Cached print-provider details keyed by id |
| `providers_by_bp/{id}.json` | Raw print_providers.json per scanned blueprint |
| `shipping/{bp}_{pid}.json` | Raw shipping.json for US blueprint×provider pairs |
| `costs/{bp}_{pid}.json` | Raw product-catalog-service v2 variants (costs in cents) |
| `variants/{bp}_{pid}.json` | Catalog variants.json titles (optional / partial backfill) |
| `catalog-us.jsonl` | One JSON object per US blueprint×provider pair |

## `catalog-us.jsonl` fields

- `blueprint_id`, `blueprint_title`, `blueprint_brand`, `blueprint_model`
- `provider_id`, `provider_name`, `provider_country`
- `us_shipping_first_cents`, `us_shipping_additional_cents` (min across US profiles; cents)
- `us_shipping_profiles`
- `variants[]`: `id`, `title`, `cost_cents`, `available`, `status`

## Sources

- `GET https://api.printify.com/v1/catalog/blueprints.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{id}/print_providers.json`
- `GET https://api.printify.com/v1/catalog/print_providers/{id}.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{id}/print_providers/{pid}/shipping.json`
- `GET https://api.printify.com/v1/catalog/blueprints/{id}/print_providers/{pid}/variants.json`
- `GET https://printify.com/product-catalog-service/api/v2/blueprints/{id}/print-providers/{pid}/variants`

Shop referenced: `29664778`. Token only via env `PRINTIFY_API_TOKEN` in Authorization header (never on disk).

## Counts (this package run)

- Blueprints total: 3022
- Blueprints scanned (providers_by_bp files): 2219
- Unique providers in providers.json: 66
- US pairs packaged (from shipping/costs caches): 2395
- JSONL lines: 2395
- Cost successes / missing: 2394 / 1
- Ship successes / missing: 2395 / 0
- Variant titles present / missing: 11511 / 100673
- Partial run: True
- Packaged at (America/Chicago box local): 2026-11-09 01:27:42 CST

## Gaps

- Keyword-filtered blueprints omitted from scan.
- Cost or shipping files missing for some pairs → empty variants or null shipping cents.
- Variant titles often null unless `variants/` backfill ran.
- Partial packaging is valid if fetch was still running.
