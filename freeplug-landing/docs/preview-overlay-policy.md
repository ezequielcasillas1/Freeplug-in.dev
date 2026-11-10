# Preview wordmark overlay policy

Data-driven gate for the site-only name-box SVG (not Printify print files).

## Regenerate

```bash
node scripts/build-preview-overlay-policy.mjs
```

Source: `src/lib/merch/preview/classification.snapshot.csv` (Printify audit Group A/B/Unknown).

## Rules (schema v2)

1. **Cohort** — Only Printify **Group A** (original Freeplug script rectangle art) may show the live overlay.
2. **Vibrant overlap** — Within Group A, suppress when the baked mockup already shows a vibrant Freeplug rectangle or other dominant color art (Cheke, Nov 10).
3. **Force keep** — `FORCE_KEEP` in the build script for products where the name variant complements the art (review in JSON `rationale`).
4. **Default off** — Group B, Unknown, and unmapped storefront SKUs never show the overlay.

Runtime: `shouldShowPreviewWordmarkOverlay` → `resolvePreviewWordmark`.
