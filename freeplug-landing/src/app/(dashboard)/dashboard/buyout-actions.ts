'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { recordBuyoutRequest, type BuyoutRequestResult } from '@/lib/buyout/buyout'
import { supabaseBuyoutStore } from '@/lib/buyout/supabase-store'
import { currentLocale } from '@/i18n/current-locale'
import { translatorFor } from '@/i18n/translate'
import { buyoutTierById, formatTierPrice } from '@/lib/buyout/tiers'
import { alertOwner } from '@/lib/owner-alerts/events'

/**
 * "Request my buyout" (dashboard and cancel page), with the tier the customer picked (Oct 19; informational,
 * written to the notes block; the admin Buyout price still overrides). Adds the buyout request to the customer's
 * website request, the same list maintenance requests use. At most one open buyout request per
 * customer: repeated calls (double click, two tabs) return alreadyRequested. No email is sent.
 */
export async function requestBuyoutQuote(tierId?: unknown): Promise<BuyoutRequestResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const locale = await currentLocale()
  const t = translatorFor(locale, 'errors.buyout.error')
  if (!user) return { ok: false, error: t('mustSigned') }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: t('somethingWentWrongSide') }
  }

  let result: BuyoutRequestResult
  try {
    result = await recordBuyoutRequest(supabaseBuyoutStore(admin), user.id, new Date(), locale, buyoutTierById(tierId))
  } catch (e) {
    console.error('[buyout] request failed', e instanceof Error ? e.message : e)
    return { ok: false, error: t('somethingWentWrongSide') }
  }
  if (result.ok && !result.alreadyRequested) {
    const tier = buyoutTierById(tierId)
    alertOwner({
      kind: 'buyout_quote_request',
      dedupeKey: `buyout:${user.id}:${new Date().toISOString().slice(0, 10)}`,
      userId: user.id,
      email: user.email ?? null,
      details: [['Pages wanted', tier ? `${tier.label} (${formatTierPrice(tier.cents)})` : 'Not picked'], ['Language', locale === 'es' ? 'Spanish' : 'English']],
      adminPath: '/admin/requests',
    })
  }
  if (result.ok) {
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cancel')
    revalidatePath('/admin', 'layout')
  }
  return result
}
