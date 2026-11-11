# Buyer wordmark kits

Place Cheke’s archives here, then run:

```bash
node scripts/ingest-buyer-wordmark-kits.mjs
```

## Incoming files

- `incoming/kit-cursive.zip` — Cursive + Cursive Plate PNGs
- `incoming/kit-pop.zip` — Pop v2 PNGs
- `incoming/kit-popplate.zip` — Pop Plate v2 PNGs

Output: `public/merch/buyer-wordmark-art/{style}/{Brand}-{on-dark|on-light}.png`

Ink rule: **on-dark** = light art on dark garments; **on-on-light** = dark art on light garments.
