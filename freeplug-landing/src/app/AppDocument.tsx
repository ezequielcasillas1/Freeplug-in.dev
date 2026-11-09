import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import type { AppLocale } from '@/i18n/config'
import type { Messages } from '@/i18n/messages'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/**
 * The <html>/<body> document. The root layout is a pass-through (next-intl pattern), so every
 * top-level tree renders this with its own `lang` (card §6 case 1: <html lang> per locale).
 */
export function AppDocument({
  lang,
  messages,
  now,
  children,
}: {
  lang: AppLocale
  messages: Partial<Messages>
  /** Only for trees with no next-intl request scope of their own (the root 404). */
  now?: Date
  children: React.ReactNode
}) {
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen" suppressHydrationWarning>
        <NextIntlClientProvider locale={lang} messages={messages} timeZone="America/Chicago" formats={{}} {...(now ? { now } : {})}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
