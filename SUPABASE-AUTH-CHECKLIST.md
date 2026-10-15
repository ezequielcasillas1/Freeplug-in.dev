# Supabase Auth settings: one visit (Ezequiel)

**When:** after Vera's email pass. Do (a) and (b) in that visit. Do (c) and (d) at the Gate 2 moment (the apex served by the Worker); if Gate 2 is the same visit, do all four.
**Where:** Supabase dashboard → the Freeplug project → Authentication.
**Rule:** nothing secret goes in this file, a chat or a ticket. The Resend key is typed only into the dashboard field.

After each step there's a **read-only check**. It changes nothing, logs nobody in and sends no email.

---

## (a) Custom SMTP: Authentication → Emails → SMTP Settings
- Enable custom SMTP: **on**
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: **your separate Supabase-only Resend key**, typed into this field only. It's not the Worker's key, and never goes in this file or anywhere else.
- Sender email: `no-reply@freeplug-in.dev`
- Sender name: `Freeplug`
- Save.

**Check (read-only):**
- Reload the page. Every field above is still there, and the password shows only as masked.
- Authentication → Rate Limits: "Rate limit for sending emails" is now editable. That only happens with custom SMTP on.
- Resend dashboard → Domains: `freeplug-in.dev` shows **Verified**.

## (b) Email templates: Authentication → Emails → Templates
In each template, replace only the link (the `href="…"` value, which today is `{{ .ConfirmationURL }}`) with the line below. Copy each line exactly. Keep the rest of the template as it is.

| Template | Link line (paste as the `href` value) |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ if .Data.freeplug_claim }}/claim{{ else }}/dashboard{{ end }}` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/dashboard` |
| Magic Link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard` |
| Change Email Address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/dashboard` |
| Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |
| Reauthentication | **No change.** It's a 6-digit code (`{{ .Token }}`), not a link, and the app doesn't use it. |

Why:
- `/auth/confirm` verifies the token on the server, so a link works in any browser.
- The default `{{ .ConfirmationURL }}` links depend on the browser that started the request (PKCE) or put the session in the URL fragment, which the server can't read.
- That breaks the password-reset fallback (now cookieless), the claim "send it again" email (`auth.resend` sends no PKCE challenge), and links opened on another device.
- `/auth/confirm` accepts only these four types and these `next` paths. Anything else lands on the neutral "This link has expired. Request a new one." page.

**Check (read-only):**
- Reopen each template's source and compare the link with the table, character for character:
  - `&` must be a plain `&`, not `&amp;`;
  - no trailing spaces;
  - `{{ .SiteURL }}` must not be followed by a second `/`.
- After Gate 2, from any terminal (no token, so nothing is verified):

```
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'https://freeplug-in.dev/auth/confirm?type=recovery&next=/reset-password'
```

  Expected: `307 https://freeplug-in.dev/link-expired?for=reset`. Before Gate 2 the old app answers instead, with `/reset-password?expired=1`.

## (c) Site URL: Authentication → URL Configuration → Site URL
- **Current value: UNKNOWN.** Read it first and send it to Aria before changing anything.
  - If it still points at the old Vercel app (`…vercel.app` or the old domain), every link in (b) goes there, because they all start with `{{ .SiteURL }}`.
- Set exactly `https://freeplug-in.dev`: https, the apex, no `www`, no trailing slash. Do it at Gate 2.

**Check (read-only):**
- Reload the page. The value is exactly `https://freeplug-in.dev`.
- `curl -sI https://freeplug-in.dev/ | head -1` answers `HTTP/2 200`.

## (d) Redirect URLs: Authentication → URL Configuration → Redirect URLs
Add these. They're the hosts the app passes as `emailRedirectTo` / `redirectTo` (`<origin>/auth/callback…`):
- `https://freeplug-in.dev/**`
- `https://www.freeplug-in.dev/**`
- `https://freeplug-preview.<workers-subdomain>.workers.dev/**` (the preview Worker; `<workers-subdomain>` is the Cloudflare account's workers.dev subdomain, not known here)
- `https://*-freeplug-preview.<workers-subdomain>.workers.dev/**` (preview URLs of individual versions)

Timing:
- The preview entries can go in at this visit.
- Add the apex and www entries at Gate 2.
- Remove the old Vercel entries only once Gate 2 has been stable for a while; they're the rollback.

**Check (read-only):** reload the list and confirm the four entries are there exactly as written (scheme, no typos, `/**` at the end) and the old entries are untouched.

---
Afterwards, Vera's next preview pass covers the parts that need a real email: sign-up confirmation (including the claim sign-up landing on `/claim`), the claim "send it again", the Supabase-sent fallback reset, and an expired link reaching the neutral page.
