CATALOG-TESTS-DONE Mon Oct 12 2026 11:38 PM CT (against :3011 at bdfe479, last_seen_at fresh at 11:34 PM CT). Valid catalog pick PASS (UI, both widths); widen rules 1 PASS (general + team widen OK, niche-from-other-type refused even with widen, other-request/other-niche widens refused); type-change rule 2 PASS (catalog cleared + gray banner; pasted/team kept). Owen may re-sync now.

STALE-TEST-DONE (Mon Oct 12 2026, 11:30 PM CT, against :3011 at f928ab5): PASS. The catalog max last_seen_at is 1:06 PM CT, more than 6 h old. On the UI (cleaning, 375), all 60 of 60 cards show the "Not available" overlay and all 60 Choose buttons are disabled. A direct saveTemplatePick server-action call for item 9412083 returned {ok:false,error:"stale"}. The request row is unchanged (no business_type, no pick).

# QA checkpoint: envato-picker-client @ f928ab5 -> bdfe479 (Grok Bot QA)
Status: DONE at 11:42 PM CT. Report: /workspace/freeplug-qa/envato-picker-qa/REPORT-client-f928ab5.md. Overall PASS, 0 High / 2 Medium / 3 Low / 6 Info.
Aria's new rules 1-4: PASS at bdfe479 (nothing PENDING).
- M1: the widen path is unreachable from the UI (no widenLogId sent; general items not listed).
- M2: ES flag 'on' vs 'true', so ES doesn't render on :3011 (verified on a private :3052, now stopped).
Not built yet: Show more moving focus to the first new card.
Remaining for Owen:
- M1, M2, L1 (banner tied to ?repick), L2 (pasted confirm title), L3 (other_local has 0 items).
Test rows (local, kept):
- user qa-picker-other@example.test
- requests a0000000-...0002 (closed) and ...0005
- widen_log 1-4
- notes='qa-guard-probe' on 4097c217
Clone /workspace/freeplug-qa/envato-picker-qa/clone-f928ab5 (at bdfe479, no .next/node_modules/.env) can be deleted.
