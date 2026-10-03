import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { oversizedActionResponse } from '@/lib/outreach/body-limit'

export async function proxy(request: NextRequest) {
  // A server-action body over the 6 MB limit gets a clean 413, not Next's HTTP 500 (Vera QA #4),
  // with or without a Content-Length (Vera r2 N5: chunked bodies are counted as they stream).
  const tooLarge = await oversizedActionResponse(request)
  if (tooLarge) return tooLarge
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
