import { NextResponse, type NextRequest } from 'next/server'

/**
 * Oct 30: '/?lang=es' was never a supported URL (only /login reads ?lang). Links/QA that use it
 * land on English, so send them to the real Spanish home '/es' (307, other query params kept).
 * Only the home page and only when Spanish is enabled; anything else returns null.
 */
export function homeLangRedirect(request: NextRequest, locales: readonly string[]): NextResponse | null {
  const url = request.nextUrl
  if (url.pathname !== '/' || url.searchParams.get('lang') !== 'es' || !locales.includes('es')) return null
  const target = url.clone()
  target.pathname = '/es'
  target.searchParams.delete('lang')
  return NextResponse.redirect(target, 307)
}
