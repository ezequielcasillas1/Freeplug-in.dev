# Merch PR — live baseline verification (2026-11-07)

## Summary

**Git `origin/main` at `b75afce` does not contain several routes/features that are live today.** Merging or deploying only `main` + merch would roll back live behavior unless the missing source is pushed first.

## What was checked

- `git fetch --all --tags`
- Remote branches: `main`, `cursor/merch-font-bundle-eed3`, `envato-picker-*`, `i18n-es` — **no** branch named `live`, `release`, `compare`, `buyout`, or `impact`
- `git log --all --grep=compare` / `in-person` — **no** commits
- GitHub code search for `/compare`, `in-person-heading`, `Freeplug vs Wix` — **no** hits
- Live fetches (200): `https://freeplug-in.dev/`, `/compare`, `/es/compare`

## Live features not in `main` source tree

| Live route / feature | On `main`? |
|----------------------|------------|
| `/compare`, `/es/compare` | **No** `src/app/**/compare` |
| Home `#compare` / footer Compare links | **No** |
| "In development" launch copy | **No** (marquee still "launching this weekend") |
| `data-section="in-person"` section | **No** |
| Buyout tiers ($1,200 / $2,000) in FAQ copy | **Yes** (release 2026-10-19 on `main`) |
| Street address removed | **Yes** on `main` footer |

## Closest git baseline

- **Commit:** `b75afce97182cf44f86fe949c3054d1be127e005` (`main`)
- **Includes:** buyout tier messaging, `/es` pattern, hosting/Stripe stack, no public street address
- **Missing vs live:** compare page, in-person section, in-development homepage updates (likely deployed from unpushed or off-repo work)

## Owner action before deploy

Push or tag the commit that matches the **current** Worker (including `/compare` and in-person) so merch can merge **on top** of that SHA without rollback.

Merch branch builds on `main` today for PR review; **do not promote** until live baseline is in git.
