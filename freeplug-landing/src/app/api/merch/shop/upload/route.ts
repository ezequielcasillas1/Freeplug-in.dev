import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { isMerchShopEnabled } from '@/lib/merch/flags'
import { uploadShopCustomArt } from '@/lib/merch/server'
import {
  parseDataUrlDimensions,
  validateMerchShopUploadMime,
  validateMerchShopUploadSize,
} from '@/lib/merch/shop/upload-validation'
import { rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const runtime = 'nodejs'

const IP_LIMIT = { bucket: 'merch_shop_upload_ip', limit: 20, windowSeconds: 3600 }

export async function POST(request: Request) {
  const h = request.headers
  if (h.get('origin') === 'null' || !isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isMerchShopEnabled()) {
    return NextResponse.json({ error: 'Shop uploads are not enabled.' }, { status: 403 })
  }
  const ip = clientIpFrom(h)
  if (!(await rateCheck(IP_LIMIT, ip))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file.' }, { status: 400 })

  const bytes = Buffer.from(await file.arrayBuffer())
  if (!validateMerchShopUploadSize(bytes.length)) {
    return NextResponse.json({ error: 'File too large.' }, { status: 400 })
  }
  if (!validateMerchShopUploadMime(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 })
  }

  const uploaded = await uploadShopCustomArt(bytes, file.type)
  if ('error' in uploaded) {
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }
  const storagePath = uploaded.path

  const previewDataUrl = `data:${file.type};base64,${bytes.toString('base64')}`
  parseDataUrlDimensions(previewDataUrl)

  return NextResponse.json({ path: storagePath, previewDataUrl })
}
