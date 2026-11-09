import type Stripe from 'stripe'
import { PRINTIFY_SHOP_ID_DEFAULT } from './catalog'

export type PrintifyAddress = {
  first_name: string
  last_name: string
  email: string
  phone: string
  country: string
  region: string
  address1: string
  address2: string
  city: string
  zip: string
}

export type PrintifyOrderLine = {
  product_id: string
  variant_id: number
  quantity: number
}

export type PrintifyCreateOrderBody = {
  external_id: string
  line_items: PrintifyOrderLine[]
  shipping_method: number
  address_to: PrintifyAddress
  send_shipping_notification?: boolean
}

export type PrintifyDeps = {
  fetch: typeof fetch
  apiToken: string
  shopId: string
}

export function printifyShopId(env: Record<string, string | undefined> = process.env): string {
  return (env.PRINTIFY_SHOP_ID ?? PRINTIFY_SHOP_ID_DEFAULT).trim()
}

export function printifyConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.PRINTIFY_API_TOKEN?.trim())
}

export function stripeShippingToPrintifyAddress(session: Stripe.Checkout.Session): PrintifyAddress | null {
  const s = session as Stripe.Checkout.Session & {
    shipping_details?: { name?: string | null; phone?: string | null; address?: Stripe.Address | null } | null
  }
  const details = s.shipping_details ?? session.customer_details
  const addr = details?.address ?? session.customer_details?.address
  if (!addr?.line1 || !addr.city || !addr.postal_code || !addr.country) return null

  const name = details?.name ?? session.customer_details?.name ?? ''
  const parts = name.trim().split(/\s+/)
  const first_name = parts[0] ?? 'Customer'
  const last_name = parts.length > 1 ? parts.slice(1).join(' ') : '-'
  const email = session.customer_details?.email ?? session.customer_email ?? ''
  if (!email) return null

  const phone = details?.phone ?? session.customer_details?.phone ?? ''

  return {
    first_name,
    last_name,
    email,
    phone: phone || '0000000000',
    country: addr.country,
    region: addr.state ?? '',
    address1: addr.line1,
    address2: addr.line2 ?? '',
    city: addr.city,
    zip: addr.postal_code,
  }
}

export async function createPrintifyOrder(
  body: PrintifyCreateOrderBody,
  deps: PrintifyDeps
): Promise<{ ok: true; orderId: string; raw: unknown } | { ok: false; error: string; status?: number }> {
  const url = `https://api.printify.com/v1/shops/${deps.shopId}/orders.json`
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
    return { ok: false, error: typeof json === 'object' && json && 'message' in json ? String((json as { message: unknown }).message) : text || res.statusText, status: res.status }
  }
  const id =
    typeof json === 'object' && json && 'id' in json
      ? String((json as { id: unknown }).id)
      : typeof json === 'object' && json && 'data' in json && (json as { data: { id?: unknown } }).data?.id != null
        ? String((json as { data: { id: unknown } }).data.id)
        : ''
  if (!id) return { ok: false, error: 'Printify order id missing from response' }
  return { ok: true, orderId: id, raw: json }
}

export async function sendPrintifyOrderToProduction(
  orderId: string,
  deps: PrintifyDeps
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `https://api.printify.com/v1/shops/${deps.shopId}/orders/${orderId}/send_to_production.json`
  const res = await deps.fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FreeplugMerch/1.0',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: text || res.statusText }
  }
  return { ok: true }
}

export function shouldAutoSendPrintifyToProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.PRINTIFY_AUTO_SEND_TO_PRODUCTION?.trim().toLowerCase() === 'true'
}
