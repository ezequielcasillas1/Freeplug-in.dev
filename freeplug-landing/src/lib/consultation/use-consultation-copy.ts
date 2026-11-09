'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { Translate } from '@/i18n/translate'
import { buildConsultationCopy } from './copy-builder'

/** Client components: consultation copy from the messages the server already resolved. */
export function useConsultationCopy() {
  const t = useTranslations('consultation') as unknown as Translate
  return useMemo(() => buildConsultationCopy(t), [t])
}
