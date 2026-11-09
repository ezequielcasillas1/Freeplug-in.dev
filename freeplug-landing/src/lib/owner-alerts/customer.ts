import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { hasWeekendReplies } from '@/lib/plans/response-days'
import type { OwnerAlertCustomer } from './format'

type Admin = {
  from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null; user_metadata?: Record<string, unknown> } | null } }> } }
}

/**
 * Who the alert is about: name/email (Auth), business (latest website request), plan step and weekend
 * replies (entitlements, same logic as the app). Every lookup is best effort: a failure leaves the field out.
 */
export async function ownerAlertCustomer(
  admin: Admin,
  q: { userId?: string | null; customerId?: string | null; email?: string | null; business?: string | null }
): Promise<OwnerAlertCustomer & { userId: string | null }> {
  const out: OwnerAlertCustomer & { userId: string | null } = { email: q.email ?? null, business: q.business ?? null, userId: q.userId ?? null }
  try {
    let customerId = q.customerId ?? null
    if (!out.userId && customerId) {
      const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).limit(1)
      out.userId = (data?.[0]?.id as string | undefined) ?? null
    }
    if (!out.userId) return out
    const userId = out.userId
    try {
      const { data } = await admin.auth.admin.getUserById(userId)
      const meta = data.user?.user_metadata ?? {}
      out.email = out.email ?? data.user?.email ?? null
      const name = (meta.full_name ?? meta.name ?? null) as string | null
      out.name = typeof name === 'string' ? name : null
      if (!out.business && typeof meta.business_name === 'string') out.business = meta.business_name
    } catch (e) {
      console.error('[owner-alert] auth lookup failed', e instanceof Error ? e.message : e)
    }
    if (!out.business) {
      try {
        const { data } = await admin.from('website_requests').select('business_name').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
        out.business = (data?.[0]?.business_name as string | undefined) ?? null
      } catch {
        /* best effort */
      }
    }
    try {
      if (!customerId) {
        const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', userId).limit(1)
        customerId = (data?.[0]?.stripe_customer_id as string | undefined) ?? null
      }
      const { entitlements } = await getUserEntitlements(admin, userId, customerId)
      out.planName = entitlements.step?.name ?? null
      out.weekendReplies = hasWeekendReplies(entitlements)
    } catch (e) {
      console.error('[owner-alert] plan lookup failed', e instanceof Error ? e.message : e)
    }
  } catch (e) {
    console.error('[owner-alert] customer lookup failed', e instanceof Error ? e.message : e)
  }
  return out
}
