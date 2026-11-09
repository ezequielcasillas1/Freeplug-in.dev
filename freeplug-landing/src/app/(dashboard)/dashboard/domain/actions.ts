'use server'

import { createClient } from '@/lib/supabase/server'
import { domainRequestSchema } from '@/lib/outreach/schemas'
import { GENERIC_TRY_AGAIN } from '@/lib/outreach/copy'
import { currentLocale } from '@/i18n/current-locale'
import { translatorFor } from '@/i18n/translate'
import { SUPPORT_EMAIL } from '@/lib/site'

const DOMAIN_INVALID_EN = 'Enter a domain like yourbusiness.com'

/** "Set up my domain": one row in domain_requests (RLS: own rows, status pending). Admin handles it by hand. */
export async function requestDomainSetup(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const locale = await currentLocale()
  const t = translatorFor(locale, 'claim')
  const tryAgain = locale === 'en' ? GENERIC_TRY_AGAIN : t('genericTryAgain', { supportEmail: SUPPORT_EMAIL })
  const parsed = domainRequestSchema.safeParse(input)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message
    if (locale === 'en') return { ok: false, error: msg ?? GENERIC_TRY_AGAIN }
    return { ok: false, error: msg === DOMAIN_INVALID_EN ? t('enterDomainLikeYourbusinessCom') : tryAgain }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: tryAgain }
  const { error } = await supabase.from('domain_requests').insert({
    user_id: user.id,
    kind: parsed.data.kind,
    domain: parsed.data.kind === 'have_domain' ? parsed.data.domain : null,
  })
  return error ? { ok: false, error: tryAgain } : { ok: true }
}
