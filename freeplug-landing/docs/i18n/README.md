# Freeplug Spanish build: catalog provenance (Owen, Oct 4 2026)

Gate: `NEXT_PUBLIC_FREEPLUG_I18N_ES` (OFF unless the literal `on`). Spanish is served only when
`messages/es.status.json` says `reviewed` AND every key is present (card C7). Local QA only:
`FREEPLUG_I18N_ES_ALLOW_PENDING=1` (scripts must never upload a build made with it).

| file | source | sha256 (source) |
|---|---|---|
| messages/en.json | /workspace/copy/freeplug-en-source-2026-10-04.json @ 09:31 CT (Sable round 1) + Owen-added keys (messages/pending-sable.json `addedByOwen`) + `common.legal.translationNotice` from the 09:54 file | 788f8a50…df55 (09:31) |
| messages/es.json | /workspace/copy/freeplug-es-draft-2026-10-04.json @ 09:31 CT (DRAFT) + `common.legal.translationNotice` from the 09:54 draft | 5eda7668…1325 (09:31) |
| docs/i18n/freeplug-es-notes-2026-10-04.md, *.keys.tsv | copies of Sable's notes / key map @ 09:31 | |

## Not wired yet (next pass)
- Sable's round-2 English fixes (/workspace/copy/freeplug-english-fixes-2026-10-04.md, 09:50–09:54 CT:
  144 rows, 24 whole-sentence keys, 9 glosses, 5 other keys, 32 DELETE keys; en source sha256
  6e806042…8ae6, es draft 870a291f…e738). Per Aria (9:37) her English fixes go in before the Spanish;
  they are not hand-edited here.
- The add-ons follow-up strings in 40ec652 / 8d57819 (ladder-fix-2026-10-03), after the rebase.

## Legal line (Aria 9:53, Sable §7 item 14)
`common.legal.translationNotice`, word for word. Rendered by `src/components/i18n/TranslationNotice.tsx`
in the landing footer and the auth frame, Spanish only; at the top of Terms and Privacy once Spanish
versions exist; never on checkout. Pinned by `src/components/i18n/translation-notice.test.tsx`.
