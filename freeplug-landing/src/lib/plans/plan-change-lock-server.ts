import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { supabasePlanChangeLockStore, type PlanChangeLockStore } from './plan-change-lock'

/**
 * The change-plan lock store on the service-role client (migration 20261003210000; Aria, Oct 3).
 * Its own allowlisted module (eslint "one service-role path"), like the email_sends ledger in
 * src/lib/email/webhook-email-ledger.ts: it can only claim / release plan_change_locks rows.
 */
export function planChangeLockStore(): PlanChangeLockStore {
  return supabasePlanChangeLockStore(createAdminClient())
}
