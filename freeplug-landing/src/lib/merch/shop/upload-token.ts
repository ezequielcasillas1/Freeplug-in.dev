import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ShopModerationResult } from './moderation'

export type UploadTokenPayload = {
  path: string
  moderation: ShopModerationResult
  slug: string
  variantId: number
  width: number
  height: number
  exp: number
}

function signingSecret(): string | null {
  const s = process.env.MERCH_SHOP_UPLOAD_SIGNING_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return s || null
}

export function signShopUploadToken(payload: UploadTokenPayload): string | null {
  const secret = signingSecret()
  if (!secret) return null
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyShopUploadToken(token: string): UploadTokenPayload | null {
  const secret = signingSecret()
  if (!secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UploadTokenPayload
    if (!payload.path || !payload.moderation || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
