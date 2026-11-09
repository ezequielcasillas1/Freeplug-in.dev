import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export function merchServiceRoleClient() {
  return createAdminClient()
}

export const MERCH_SHOP_UPLOAD_BUCKET = 'merch-shop-uploads'

export async function uploadShopCustomArt(bytes: Buffer, contentType: string): Promise<{ path: string } | { error: string }> {
  const ext =
    contentType === 'image/png' ? 'png' : contentType === 'image/svg+xml' ? 'svg' : 'jpg'
  const objectName = `${randomUUID()}.${ext}`
  const admin = createAdminClient()
  const { error } = await admin.storage.from(MERCH_SHOP_UPLOAD_BUCKET).upload(objectName, bytes, {
    contentType,
    upsert: false,
  })
  if (error) {
    console.error('[merch/server] upload', error.message)
    return { error: 'upload_failed' }
  }
  return { path: `${MERCH_SHOP_UPLOAD_BUCKET}/${objectName}` }
}
