import { NextResponse } from 'next/server'
import { merchServiceRoleClient } from '@/lib/merch/server'
import { recordMerchDownload, validateMerchToken } from '@/lib/merch/tokens'
import { merchDownloadFilename, readMerchBundleBytes, isMerchMockBundle } from '@/lib/merch/storage'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim()
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid download token.' }, { status: 400 })
  }

  let admin: ReturnType<typeof merchServiceRoleClient>
  try {
    admin = merchServiceRoleClient()
  } catch (e) {
    console.error('[merch/download] admin', e)
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }

  const validation = await validateMerchToken(admin, token)
  if (!validation.ok) {
    const status = validation.reason === 'not_found' ? 404 : 403
    const message =
      validation.reason === 'expired'
        ? 'This download link has expired.'
        : validation.reason === 'revoked'
          ? 'This download link is no longer valid.'
          : validation.reason === 'limit'
            ? 'Download limit reached for this link.'
            : 'Invalid download token.'
    return NextResponse.json({ error: message }, { status })
  }

  const recorded = await recordMerchDownload(admin, validation.row)
  if (!recorded.ok) {
    return NextResponse.json({ error: 'Download limit reached for this link.' }, { status: 403 })
  }

  try {
    const bytes = await readMerchBundleBytes()
    const contentType = isMerchMockBundle() ? 'text/plain; charset=utf-8' : 'application/zip'
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${merchDownloadFilename()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[merch/download] bundle', e)
    return NextResponse.json({ error: 'Bundle file is not available.' }, { status: 503 })
  }
}
