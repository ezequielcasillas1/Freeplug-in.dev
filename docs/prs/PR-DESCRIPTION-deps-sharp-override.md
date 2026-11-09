# deps: override sharp to $sharp (^0.35.5), no wrangler bump

Fixes GHSA-wq5f-xc86-pv6w (sharp <0.35.5 nested under wrangler > miniflare). Base: security-headers 4aaa0b5. Approved by Aria.

`npm ls sharp --all` at bc5f62b:

```
freeplug-landing@0.1.0
├─┬ next@16.3.8
│ └── sharp@0.35.5 deduped
├── sharp@0.35.5 overridden
└─┬ wrangler@4.147.0
  └─┬ miniflare@5.20261001.0-alpha
    └── sharp@0.35.5 deduped
```

Checks: npm audit clears sharp/miniflare/wrangler (5 eslint-chain highs remain, accepted in SECURITY-NOTES.md); OpenNext build PASS; `wrangler deploy --dry-run` PASS (no upload, no CF credentials); local `wrangler dev` GET / 200; 1,961 tests pass; Arkitect verify 5/5; gitleaks clean.
