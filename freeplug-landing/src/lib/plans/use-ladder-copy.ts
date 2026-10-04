import { useLocale } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { ladderCopy, type LadderCopy } from './ladder-copy'

/** Ladder copy in the page's language, for client and (non-async) server components. */
export function useLadderCopy(): LadderCopy {
  return ladderCopy(toAppLocale(useLocale()))
}
