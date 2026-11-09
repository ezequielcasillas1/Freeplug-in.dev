import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { isMerchShopEnabled } from '@/lib/merch/flags'
import { uploadShopCustomArt } from '@/lib/merch/server'
import { getShopItem, resolveShopVariant } from '@/lib/merch/shop/catalog'
import { printAreaSizeInches } from '@/lib/merch/shop/print-area'
import { moderateShopUploadImage } from '@/lib/merch/shop/moderation'
import { getShopModerationAiRunner, getShopModerationImages } from '@/lib/merch/shop/workers-ai'
import { shopModerationImageBytes } from '@/lib/merch/shop/moderation-image'
import { signShopUploadToken } from '@/lib/merch/shop/upload-token'
import {
  meetsMinDpi,
  parseDataUrlDimensions,
  validateMerchShopUploadMime,
  validateMerchShopUploadSize,
} from '@/lib/merch/shop/upload-validation'
import { rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const runtime = 'nodejs'

const IP_LIMIT = { bucket: 'merch_shop_upload_ip', limit: 20, windowSeconds: 3600 }
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

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

  const slug = String(form.get('slug') ?? '').trim()
  const variantId = parseInt(String(form.get('variant_id') ?? form.get('variantId') ?? ''), 10)
  const item = getShopItem(slug)
  const variant = item && Number.isFinite(variantId) ? resolveShopVariant(item, variantId) : null
  const printArea = variant?.printArea ?? item?.printArea
  if (!item || !printArea) {
    return NextResponse.json({ error: 'Unknown product.' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (!validateMerchShopUploadSize(bytes.length)) {
    return NextResponse.json({ error: 'upload_too_large', code: 'upload_too_large' }, { status: 400 })
  }
  if (!validateMerchShopUploadMime(file.type)) {
    return NextResponse.json({ error: 'upload_type_unsupported', code: 'upload_type_unsupported' }, { status: 400 })
  }

  const previewDataUrl = `data:${file.type};base64,${bytes.toString('base64')}`
  const dims = parseDataUrlDimensions(previewDataUrl)
  if (!dims) {
    return NextResponse.json({ error: 'upload_unreadable', code: 'upload_unreadable' }, { status: 400 })
  }
  const { widthIn, heightIn } = printAreaSizeInches(printArea)
  if (!meetsMinDpi(dims.width, dims.height, widthIn, heightIn)) {
    return NextResponse.json({ error: 'upload_dpi_low', code: 'upload_dpi_low' }, { status: 400 })
  }

  // Moderate a downscaled copy (max 1024px side) so large images do not time out llava; the
  // original bytes are what gets stored. No usable copy = held (fail-safe).
  const moderationBytes = await shopModerationImageBytes(bytes, file.type, await getShopModerationImages(), dims)
  const moderation = moderationBytes
    ? await moderateShopUploadImage(moderationBytes, file.type, await getShopModerationAiRunner())
    : { result: 'held' as const, detail: { reason: 'moderation_resize_failed' } }
  if (moderation.result === 'fail') {
    return NextResponse.json(
      { error: 'upload_moderation_blocked', code: 'upload_moderation_blocked', moderation: moderation.result },
      { status: 400 }
    )
  }

  const uploaded = await uploadShopCustomArt(bytes, file.type)
  if ('error' in uploaded) {
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }
  const storagePath = uploaded.path

  const token = signShopUploadToken({
    path: storagePath,
    moderation: moderation.result,
    slug,
    variantId: variant?.id ?? variantId,
    width: dims.width,
    height: dims.height,
    exp: Date.now() + TOKEN_TTL_MS,
  })

  return NextResponse.json({
    path: storagePath,
    previewDataUrl,
    moderation: moderation.result,
    uploadToken: token,
    moderationDetail: moderation.detail,
  })
}
