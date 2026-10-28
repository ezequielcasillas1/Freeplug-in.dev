import 'server-only'
import { headers } from 'next/headers'
import { getLocale, getMessages } from 'next-intl/server'
import { DOC_LANG_HEADER } from '@/i18n/doc-lang'
import { enabledLocales } from '@/i18n/gate'
import { messagesFor } from '@/i18n/messages'
import { toAppLocale } from '@/i18n/config'
import type { Messages } from '@/i18n/messages'
import { AppDocument } from './AppDocument'

/** Document for unprefixed app trees (auth, dashboard, claim, preview): locale from profile/cookie. */
export async function AppTreeDocument({ children }: { children: React.ReactNode }) {
  // /login?lang=es: the proxy marks the request so the document is Spanish too (Oct 28).
  const forceEs = (await headers()).get(DOC_LANG_HEADER) === 'es' && enabledLocales().includes('es')
  const locale = forceEs ? 'es' : toAppLocale(await getLocale())
  const messages = (forceEs ? messagesFor('es') : await getMessages()) as Messages
  return (
    <AppDocument lang={locale} messages={messages}>
      {children}
    </AppDocument>
  )
}
