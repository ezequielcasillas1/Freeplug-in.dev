import type Stripe from 'stripe'
import { getEntitlements } from '@/lib/stripe/active-subscription'
import type { Entitlements } from './ladder'
import { loadPlanSnapshotRow, resolveEntitlements, type EntitlementSource } from './plan-snapshot'

/**
 * A customer's perks as the app shows and enforces them: the webhook-written snapshot on profiles
 * (src/lib/plans/plan-snapshot.ts), or Stripe for a profile never synced yet. `client` may be the
 * customer's own Supabase client (owner can select their profile) or the service-role client.
 */
export async function getUserEntitlements(
  client: unknown,
  userId: string,
  customerId: string | null,
  stripe?: Stripe
): Promise<{ entitlements: Entitlements; source: EntitlementSource }> {
  const row = await loadPlanSnapshotRow(client, userId)
  return resolveEntitlements(row, customerId, (id) => getEntitlements(id, stripe))
}
