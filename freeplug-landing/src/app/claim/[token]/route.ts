import { NextResponse } from 'next/server'
import { enterPreviewWithToken } from '@/lib/outreach/server'
import { PREVIEW_RESPONSE_HEADERS } from '@/lib/outreach/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** /claim/<token>: same token check as /p/<token>, then straight to the claim steps (/claim). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await enterPreviewWithToken(token)
  const res = NextResponse.redirect(new URL('/claim', request.url), 303)
  for (const [k, v] of Object.entries(PREVIEW_RESPONSE_HEADERS)) res.headers.set(k, v)
  return res
}
