import type { PrintifyDeps } from '../shirts/printify'
import type { ShopCatalogItem, ShopVariant } from './types'

export async function uploadPrintifyImage(
  bytes: Uint8Array,
  fileName: string,
  deps: PrintifyDeps
): Promise<{ ok: true; imageId: string } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('file_name', fileName)
  form.append('file', new Blob([Buffer.from(bytes)]), fileName)
  const res = await deps.fetch('https://api.printify.com/v1/uploads/images.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deps.apiToken}`, 'User-Agent': 'FreeplugMerch/1.0' },
    body: form,
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    return { ok: false, error: typeof json === 'object' && json && 'message' in json ? String((json as { message: unknown }).message) : text }
  }
  const id =
    typeof json === 'object' && json && 'id' in json
      ? String((json as { id: unknown }).id)
      : typeof json === 'object' && json && 'file_name' in json
        ? String((json as { id?: unknown }).id ?? '')
        : ''
  if (!id) return { ok: false, error: 'printify_image_id_missing' }
  return { ok: true, imageId: id }
}

export async function createPrintifyCustomProduct(
  item: ShopCatalogItem,
  variant: ShopVariant,
  imageId: string,
  placement: { x: number; y: number; scale: number },
  deps: PrintifyDeps
): Promise<{ ok: true; productId: string } | { ok: false; error: string }> {
  const body = {
    title: `${item.title} (custom)`,
    description: `Buyer custom artwork for ${item.slug}`,
    blueprint_id: item.blueprintId,
    print_provider_id: item.providerId,
    variants: [{ id: variant.id, price: variant.retailCents, is_enabled: true }],
    print_areas: [
      {
        variant_ids: [variant.id],
        placeholders: [
          {
            position: variant.printArea.place,
            images: [
              {
                id: imageId,
                x: placement.x,
                y: placement.y,
                scale: placement.scale,
                angle: 0,
              },
            ],
          },
        ],
      },
    ],
  }
  const url = `https://api.printify.com/v1/shops/${deps.shopId}/products.json`
  const res = await deps.fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FreeplugMerch/1.0',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    return { ok: false, error: typeof json === 'object' && json && 'message' in json ? String((json as { message: unknown }).message) : text }
  }
  const productId =
    typeof json === 'object' && json && 'id' in json
      ? String((json as { id: unknown }).id)
      : ''
  if (!productId) return { ok: false, error: 'printify_product_id_missing' }
  return { ok: true, productId }
}
