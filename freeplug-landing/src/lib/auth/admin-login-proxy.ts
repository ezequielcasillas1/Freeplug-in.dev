import { NextResponse, type NextRequest } from 'next/server'
import { withTerminalResponseHeaders } from '@/lib/outreach/headers'
import { ADMIN_LOGIN_INTERNAL_PATH, adminLoginPublicPath } from './admin-login'

/**
 * The internal admin login route is never reachable directly (404); only the secret slug
 * (ADMIN_LOGIN_PATH, server env) is rewritten to it. Unset/short slug = no admin login route at all.
 * Returns null when the request is not about the admin login.
 */
export function adminLoginProxyResponse(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (pathname === ADMIN_LOGIN_INTERNAL_PATH || pathname.startsWith(`${ADMIN_LOGIN_INTERNAL_PATH}/`)) {
    return withTerminalResponseHeaders(new NextResponse('Not found', { status: 404 }), pathname)
  }
  const slug = adminLoginPublicPath()
  if (!slug || pathname !== slug) return null
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_LOGIN_INTERNAL_PATH
  const res = NextResponse.rewrite(url)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

/** /es/login never existed (login is unprefixed); send it to the Spanish maintenance/login page. */
export function esLoginRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (pathname !== '/es/login' && pathname !== '/es/login/') return null
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('lang', 'es')
  return NextResponse.redirect(url, 307)
}
