import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { spanishEnabled } from '@/i18n/gate'

/**
 * Refreshes the Supabase session and guards /dashboard, /login, /signup.
 * `base` is the next-intl response for public localized pages (a rewrite such as '/faq' ->
 * '/en/faq'); when given, refreshed session cookies are written onto it instead of a fresh
 * NextResponse.next(), so the rewrite is kept (card §5 C2).
 */
export async function updateSession(request: NextRequest, base?: NextResponse) {
  let supabaseResponse = base ?? NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        if (!base) supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (path.startsWith('/dashboard') && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  // '/signup' and its Spanish twin '/es/signup' (C2); the dashboard itself is unprefixed.
  const isSignup = path === '/signup' || (spanishEnabled() && path === '/es/signup')
  if (user && (path === '/login' || isSignup)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
