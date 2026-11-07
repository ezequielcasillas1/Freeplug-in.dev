'use client'

import { CALCOM_BOOKING_URL } from '@/lib/booking/calcom'
import { cn } from '@/lib/utils/cn'
import { useTranslations } from 'next-intl'

type Props = {
  className?: string
  variant?: 'hero' | 'default'
}

export function BookLiveSessionLink({ className, variant = 'default' }: Props) {
  const t = useTranslations('public.landing.booking')
  return (
    <a
      href={CALCOM_BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="book-live-session"
      className={cn(className)}
    >
      {t('bookLiveSession')}
      <span className="sr-only"> {t('opensInNewTab')}</span>
    </a>
  )
}
