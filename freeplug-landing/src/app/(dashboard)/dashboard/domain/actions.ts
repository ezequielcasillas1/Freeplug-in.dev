'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentLocale } from '@/i18n/current-locale'
import { sendMail } from '@/lib/email/mailer'
import { scheduleAfterResponse } from '@/lib/background'
import { alertOwner } from '@/lib/owner-alerts/events'
import { getClaimedSiteForUser, insertDomainRequestAsService } from '@/lib/outreach/server'
import { submitDomainRequest, type DomainLocale, type DomainSubmitResult } from '@/lib/domain/flow'

const asLocale = (v: unknown): DomainLocale | null => (v === 'es' ? 'es' : v === 'en' ? 'en' : null)

/**
 * "Save my choice" on /dashboard/domain: one domain_requests row (customer's own client, RLS), then
 * in the background the customer's email (profiles.locale, else the page locale) and an owner alert.
 * Buy-for-me consent is checked here too. Nothing is bought automatically.
 */
export async function requestDomainSetup(input: unknown): Promise<DomainSubmitResult> {
  const locale: DomainLocale = (await currentLocale()) === 'es' ? 'es' : 'en'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'save_failed' }
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const res = await submitDomainRequest(input, { userId: user.id, email: user.email ?? null, locale }, {
    // Customers have no INSERT grant (migration 20261019120000): the row is written with the service
    // role, only after auth + the consent check above. user_id always comes from the session.
    insert: (row) => insertDomainRequestAsService({ ...row, user_id: user.id }),
    customer: async () => {
      const [{ data: prof }, { data: wr }, site] = await Promise.all([
        supabase.from('profiles').select('locale').eq('id', user.id).maybeSingle(),
        supabase.from('website_requests').select('business_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        getClaimedSiteForUser(user.id).catch(() => null),
      ])
      const full = String(meta.first_name ?? meta.full_name ?? meta.name ?? '').trim()
      return {
        email: user.email ?? null,
        firstName: full ? full.split(/\s+/)[0] : null,
        business: (site?.business_name as string | undefined) ?? (wr?.business_name as string | undefined) ?? null,
        freeplugUrl: (site?.live_url as string | null | undefined) ?? null,
        locale: asLocale(prof?.locale),
      }
    },
    sendMail: (p) => sendMail(p),
    alertOwner,
    background: scheduleAfterResponse,
    now: () => new Date(),
  })
  if (res.ok) revalidatePath('/dashboard/domain')
  return res
}
