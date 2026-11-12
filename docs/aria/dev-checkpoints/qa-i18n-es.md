# QA checkpoint: Spanish dashboard (i18n-es) - Vera Noll
Updated: Oct 12, 2026 12:02 PM CT

## State
- Last tested: 258e897. Result: FAIL. Report: /workspace/freeplug-qa/i18n-toggle-qa/REPORT-258e897.md (screenshots are in the 258e897/ folder next to it).
- Spanish that doesn't match Sable's files: /workspace/freeplug-qa/i18n-toggle-qa/ES-DRIFT-258e897.md and .json. Group A: copy Sable's Spanish. Group B: Sable rewrote these, now in /workspace/copy/freeplug-es-drift-groupB-2026-10-12.json. Group C: keys only in Sable's files. Group D: keys only in the branch.
- Status: PARKED by Jace/Cheke on Oct 12. Nothing is under test right now.

## Next step when it resumes
Retest Owen's single new i18n-es commit once on :3000, logged in as the seeded user with a plan (2+ add-ons and 1 refund line, local Supabase and the Stripe mock only). Check:
- Every page, EN to ES and back, and that the language sticks after logging out and back in.
- Every finding from the 258e897 report.
- The language banner: shows on public and dashboard pages, the question and link are in the offered language, only an X to close it, no page jump when it closes.
- The change-request cap lines.
- The mismatched Spanish, groups A through D.
- The hosting rule at 375.
- Toast width.
- Tabs: the active tab scrolls into view, with a fade on the right edge.
- Button pairs stack below 400px.
- Sable's 3 wording fixes and the rebase file items.
- Plans, Cancel and the alerts, live.
Leave the 7 [ask Cheke] lines and the 25 [STRICT] lines open for his call and the native-speaker sign-off.
Screenshots at 375 and 1280, plus Lina's five 375 shots (Configuración tab active, a toast, the banner on an EN and an ES page, the Plans sticky bar with confirm open).

## Ports and rules
- :3000 is the review server. Normal use only; never restart or edit it.
- No Stripe test-mode writes, and no emails.
