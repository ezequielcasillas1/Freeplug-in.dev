# qa-security checkpoint, Oct 12, 2026, ~6:40 PM CT
- A auth-rate-limit c454688: PASS. :3002 and :3004 (TRUST_CF=true, c454688) tested. 1933 tests, gitleaks clean. Report: /workspace/freeplug-qa/security-qa/REPORT-c454688.md
- B security-headers 1182f2d: PASS with findings. Headers snapshot at a clean 1182f2d; later tests on 1182f2d+WIP; Owen's wt now dbdf69c. 1937 tests, audit 0, gitleaks clean. Report: REPORT-security-headers-1182f2d.md
- Pending: re-run on Owen's new hashes (sign-in fail-open, weak-password msg, rebased headers/dbdf69c); fault-injection test of DB-error behavior; prod build for CSP unsafe-eval; Turnstile; payment (not done by rule).
- Private clones: /workspace/freeplug-qa/security-qa/clone/{rl,sh}; scripts in work/ (a.js :3002, c.js :3004, b/d/e/f/g.js :3003). rate_limit_hits reset at the end.

# Round 2, Oct 12, 2026 ~7:10 PM CT (auth-rate-limit 2c2e5a5 on :3002/:3004, security-headers cef8abd on :3003; 3d5b0bc was replaced before testing)
- Report: /workspace/freeplug-qa/security-qa/REPORT-r2-2c2e5a5-cef8abd.md. Items 1–10 and 12 PASS. Item 11: rl 1940 tests, gitleaks clean, BUT audit 1 high (source-map-js), fixed on cef8abd. sh 1959 tests, audit 0, gitleaks clean.
- Correct password during the 20/h email lock is BLOCKED. Fail-open verified live on my clone :3040 (bad service key). Prod build :3041 has no unsafe-eval.
- Clones moved to rl=2c2e5a5, sh=cef8abd (.env.local removed). Scripts: work/r2a.js (:3002), r2c.js/r2c2.js (:3004), r2b.js (:3003), r2e.js (:3040), timed.sh (9:00 click-through, 9:25 rate_limit_hits wipe → timed.log).
- 7:47 PM CT: resumed after interrupt; all tests done earlier; timed.sh (pid 1410962) still pending for 9:00 click-through / 9:25 wipe. Temp files removed.
- 20:10 CT: waiting for 9:00
- 9:00 PM CT: CLICKTHROUGH-cheke.md written (21:00:16).
- 9:25 PM CT: rate_limit_hits wiped (0). Final report complete. DONE.
- Round 3 (4aaa0b5) 9:32–9:50 PM CT: REPORT-r3-4aaa0b5.md, items 1–5 PASS, rows wiped to 0 at 9:49, :3040 stopped.
