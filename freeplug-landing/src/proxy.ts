import { type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { updateSession } from '@/lib/supabase/middleware'
import { oversizedActionResponse } from '@/lib/outreach/body-limit'
import { withTerminalResponseHeaders } from '@/lib/outreach/headers'
import { routing, shouldRunIntlRouting } from '@/i18n/routing'

const handleI18nRouting = createIntlMiddleware(routing)

/**
 * Order (Spanish build, card §5 C2):
 *   1. 413 guard (unchanged, first: an oversized server-action body never reaches anything else).
 *   2. next-intl, ONLY for the public localized pages ('/', '/faq', '/signup', '/request-website'
 *      and their /es twins; /en/... redirects to the unprefixed URL). It rewrites '/faq' to the
 *      internal '/en/faq'. App pages (/dashboard, /login, /claim, /auth, /admin, /api) never pass
 *      through it, so Supabase redirect URLs and the Auth allow-list do not change.
 *   3. Supabase updateSession on the SAME response (session cookies land on the intl rewrite), and
 *      its /signup check also matches /es/signup.
 * Every terminal response (413, intl redirect, auth redirect) goes through
 * withTerminalResponseHeaders, because OpenNext skips next.config headers on proxy redirects.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // A server-action body over the 6 MB limit gets a clean 413, not Next's HTTP 500 (Vera QA #4),
  // with or without a Content-Length (Vera r2 N5: chunked bodies are counted as they stream).
  const tooLarge = await oversizedActionResponse(request)
  if (tooLarge) return withTerminalResponseHeaders(tooLarge, pathname)

  // Not on the internal pass of next-intl's own rewrite, or '/' loops 307 -> '/' (see shouldRunIntlRouting).
  const intlResponse = shouldRunIntlRouting(pathname, request.headers) ? handleI18nRouting(request) : undefined
  if (intlResponse && isRedirectResponse(intlResponse)) return withTerminalResponseHeaders(intlResponse, pathname)

  // Redirects built here skip next.config.ts headers() on OpenNext (Cloudflare port, Oct 3).
  return withTerminalResponseHeaders(await updateSession(request, intlResponse), pathname)
}

function isRedirectResponse(res: Response): boolean {
  return res.status >= 300 && res.status < 400 && res.headers.has('location')
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
