# auth-rate-limit checkpoint, Oct 12, 2026, 6:20 PM CT (Owen)

- Branch auth-rate-limit @ c454688. Base is f5a0f2a (change-requests f186a7f + ladder-fix-2026-10-03 915391e). Worktree /workspace/owen/auth-rate-limit-wt. PR #1 is against FP0.5: https://github.com/ezequielcasillas1/Freeplug-in.dev/pull/1 (not merged).
- Stacked on top: security-headers (3923048, 7f53023, 5cf4e71, 1182f2d). Worktree /workspace/owen/security-headers-wt. PR #2: https://github.com/ezequielcasillas1/Freeplug-in.dev/pull/2
- Dev servers: :3002 runs auth-rate-limit (log /workspace/owen/auth-rate-limit-3002.log). :3003 runs security-headers (log /workspace/owen/security-headers-3003.log). Both use local Docker Supabase 127.0.0.1:54321 and start with the full env -u prefix (ENVATO_API_TOKEN unset).
- QA login: /workspace/aria/dev-checkpoints/qa-ratelimit-login.md (chmod 600, local only).

## How the limit works
- DB-backed: public.rate_check plus the public.rate_limit_hits table. It's a sliding window, keys are sha256-hashed, and it's shared across processes. It is not in-memory.
- signIn: before calling Supabase, a read-only count of signin_fail_email_ip hits for "email|ip" in the last 15 min. If it's 5 or more, the user sees 'Too many attempts. Please try again later.' Only failures add a hit. The lock ends when the oldest of the 5 failures is older than 15 min.
- signUp: rateCheck(signup_ip, 5 per 3600 s), checked on every attempt.
- Both fail closed if the DB errors.
- Client IP comes from clientIpFrom (unchanged). It uses CF-Connecting-IP only when TRUST_CF_CONNECTING_IP=true and the value is a valid IP. X-Forwarded-For is never read. Otherwise every request shares the 'unknown-ip' bucket.
  - Locally, every request is "unknown-ip". Sign-in is then effectively per email, and sign-up is 5 per hour for everyone on that server.
- To simulate a different IP: start a server with TRUST_CF_CONNECTING_IP=true and send a `CF-Connecting-IP: 203.0.113.x` header.
- To reset: delete from public.rate_limit_hits where bucket in ('signin_fail_email_ip','signup_ip') in LOCAL Supabase.

## Lina's UI note
- The blocked message appears in the existing ?error= red role=alert line at the top of the card, above the form. It is not a toast and not directly above the submit button.
- The email field is NOT kept after a blocked or failed attempt. login/signup page.tsx have no defaultValue from the query. That's out of scope (actions.ts only); it needs a page.tsx change.

## Update Oct 12, 2026, 6:55 PM CT (Owen)
- auth-rate-limit is at 2c2e5a5 (pushed).
- security-headers is at 3d5b0bc (pushed). It is a normal merge of auth-rate-limit plus its own commits. Nothing was rebased or force-pushed.
- Ports:
  - :3002 runs auth-rate-limit.
  - :3003 runs security-headers.
  - :3004 runs auth-rate-limit with TRUST_CF_CONNECTING_IP=true, from worktree /workspace/owen/auth-rate-limit-vera-wt (detached at 2c2e5a5), for Vera's IP testing via the CF-Connecting-IP header.
- Sign-in on a limiter DB error now fails open: it logs and alerts admins (ADMIN_EMAILS + sendMail, at most once per 10 min).
- Sign-up on a limiter DB error is still blocked, with "Something went wrong on our end. Please try again in a minute."
- A successful sign-in clears that email's failure counts.
- Per-email cap: 20 failures per hour across all IPs locks that email.
- Cheke login: /workspace/aria/dev-checkpoints/qa-cheke-login.md
