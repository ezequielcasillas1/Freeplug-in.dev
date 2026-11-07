import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { isMerchPersonalDownloadEnabled } from '@/lib/merch/flags'
import {
  MERCH_PERSONAL_DEMO_FILENAME,
  isMerchPersonalDemoMock,
  readMerchPersonalDemoBytes,
} from '@/lib/merch/storage'
import { rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const runtime = 'nodejs'

const IP_LIMIT = { bucket: 'merch_personal_font_ip', limit: 20, windowSeconds: 3600 }
const EMAIL_LIMIT = { bucket: 'merch_personal_font_email', limit: 5, windowSeconds: 3600 }

type Body = { email?: unknown }

export async function POST(request: Request) {
  if (!isMerchPersonalDownloadEnabled()) {
    return NextResponse.json({ error: 'Personal download is not available yet.' }, { status: 403 })
  }

  const h = request.headers
  if (h.get('origin') === 'null' || !isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = clientIpFrom(h)
  if (!(await rateCheck(IP_LIMIT, ip))) {
    return NextResponse.json({ error: 'Too many downloads. Try again later.' }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as Body | null
  const email = typeof body?.email === 'string' && body.email.includes('@') ? body.email.trim().toLowerCase() : null
  if (email && !(await rateCheck(EMAIL_LIMIT, email))) {
    return NextResponse.json({ error: 'Too many downloads for this email. Try again later.' }, { status: 429 })
  }

  try {
    const bytes = await readMerchPersonalDemoBytes()
    const contentType = isMerchPersonalDemoMock() ? 'text/plain; charset=utf-8' : 'application/zip'
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${MERCH_PERSONAL_DEMO_FILENAME}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[merch/personal-download]', e)
    return NextResponse.json({ error: 'Demo file is not available.' }, { status: 503 })
  }
}
