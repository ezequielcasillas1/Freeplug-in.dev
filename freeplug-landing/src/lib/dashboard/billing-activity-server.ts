import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDowngradeRefundAlert } from '@/lib/stripe/downgrade-refund-alert'
import type { DowngradeRefundEvent } from '@/lib/stripe/change-plan'
import { downgradeRefundActivityRow } from './billing-activity'

/** Inserts the client's "Refund" activity row once (ignoreDuplicates on activity_key). */
export async function recordDowngradeRefundActivity(o: DowngradeRefundEvent): Promise<void> {
  const row = downgradeRefundActivityRow(o)
  if (!row) return
  const { error } = await createAdminClient().from('billing_activity').upsert(row, { onConflict: 'activity_key', ignoreDuplicates: true })
  if (error) throw new Error(`billing_activity: ${error.message}`)
}

/** onDowngradeRefund: activity row + owner alert; each failure is logged, neither blocks the other. */
export async function onDowngradeRefund(o: DowngradeRefundEvent): Promise<void> {
  const [a, b] = await Promise.allSettled([recordDowngradeRefundActivity(o), sendDowngradeRefundAlert(o)])
  if (a.status === 'rejected') console.error('[downgrade-refund] activity row failed', a.reason instanceof Error ? a.reason.message : a.reason)
  if (b.status === 'rejected') console.error('[downgrade-refund] alert failed', b.reason instanceof Error ? b.reason.message : b.reason)
}
