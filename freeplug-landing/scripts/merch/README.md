# Merch art and Printify draft tooling

Copied from the box (`/workspace/logos/freeplug/merch/`, plus font build scripts from
`/workspace/logos/freeplug/{cursive/source,demo-build,tshirts}/`) on 2026-11-09.

These are the art pipeline and Printify draft-creation scripts, not the shop runtime
(that lives in `src/lib/merch/shop/`). Scripts and markdown manifests only; no images.

- The art sources (PNGs, mockups, raw catalog dumps) are meant for the private Cloudflare R2
  bucket `freeplug-design-art` (NOT uploaded yet: R2 is not enabled on the account). Until then they stay on the box. See `docs/design-art-manifest.md`.
- Scripts read API tokens from the environment. Never hard-code a token.
- Paths inside the scripts still point at box locations (`/workspace/logos/...`).
