'use client'

import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { cn } from '@/lib/utils/cn'

/**
 * Aria's legal line (9:53 AM CT, Sable's key common.legal.translationNotice, text word for word):
 * "Traducción para tu conveniencia; la versión en inglés prevalece."
 * PLACEMENT: the footer of every Spanish page (Footer.tsx, and the auth frame, which has no landing
 * footer), and the TOP of the Terms and Privacy pages once Spanish versions exist. NEVER on
 * checkout (claim flow, Plans card, add-ons, Stripe params): translation-notice.test.tsx pins it.
 * Spanish only: the English value exists so the en/es key sets match, and is never rendered.
 */
export const TRANSLATION_NOTICE_KEY = 'common.legal.translationNotice'

export function TranslationNotice({ className }: { className?: string }) {
  const locale = toAppLocale(useLocale())
  const t = useTranslations('common.legal')
  if (locale !== 'es') return null
  return (
    <p data-testid="translation-notice" className={cn('text-xs', className)}>
      {t('translationNotice')}
    </p>
  )
}
