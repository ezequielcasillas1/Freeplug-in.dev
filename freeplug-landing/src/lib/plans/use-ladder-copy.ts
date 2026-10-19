import { useMemo } from 'react'
import { useLocale, useMessages } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import type { Messages } from '@/i18n/messages'
import { ladderCopy, type LadderCopy } from './ladder-copy'

/**
 * Ladder copy in the page's language, for client and (non-async) server components. Built from the
 * provider's messages, so it follows the server's locale decision (gate, draft status and the
 * local FREEPLUG_I18N_ES_ALLOW_PENDING flag) instead of re-deciding in the browser.
 */
export function useLadderCopy(): LadderCopy {
  const locale = toAppLocale(useLocale())
  const messages = useMessages() as unknown as Messages
  return useMemo(() => ladderCopy(locale, messages), [locale, messages])
}
