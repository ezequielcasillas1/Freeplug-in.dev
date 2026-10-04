import 'server-only'
import { getLocale, getMessages } from 'next-intl/server'
import { toAppLocale } from '@/i18n/config'
import type { Messages } from '@/i18n/messages'
import { AppDocument } from './AppDocument'

/** Document for unprefixed app trees (auth, dashboard, claim, preview): locale from profile/cookie. */
export async function AppTreeDocument({ children }: { children: React.ReactNode }) {
  const locale = toAppLocale(await getLocale())
  const messages = (await getMessages()) as Messages
  return (
    <AppDocument lang={locale} messages={messages}>
      {children}
    </AppDocument>
  )
}
