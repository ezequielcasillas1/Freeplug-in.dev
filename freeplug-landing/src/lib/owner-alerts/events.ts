import { createAdminClient } from '@/lib/supabase/admin'
import { ownerAlertCustomer } from './customer'
import { scheduleOwnerAlert } from './send'
import type { OwnerAlert, OwnerAlertKind } from './format'

/**
 * Owner alert for a customer action (signup, website/maintenance/buyout request, edit request, opt-out).
 * Call AFTER the main write succeeded; read request-scoped values (locale, form fields) before calling.
 * Runs after the response; never throws into the action.
 */
export function alertOwner(input: {
  kind: OwnerAlertKind
  dedupeKey: string
  userId?: string | null
  email?: string | null
  business?: string | null
  details?: OwnerAlert['details']
  adminPath?: string
  /** Skip the Auth/plan lookups (e.g. an opt-out from a cold email: only the address is known). */
  lookup?: boolean
}): void {
  const at = new Date()
  scheduleOwnerAlert(input.kind, async () => {
    let customer: OwnerAlert['customer'] = { email: input.email ?? null, business: input.business ?? null }
    if (input.lookup !== false && input.userId) {
      try {
        customer = await ownerAlertCustomer(createAdminClient() as unknown as Parameters<typeof ownerAlertCustomer>[0], {
          userId: input.userId,
          email: input.email,
          business: input.business,
        })
      } catch (e) {
        console.error('[owner-alert] no service role; sending without lookups', e instanceof Error ? e.message : e)
      }
    }
    return { alert: { kind: input.kind, customer, details: input.details, adminPath: input.adminPath, at }, dedupeKey: input.dedupeKey }
  })
}
