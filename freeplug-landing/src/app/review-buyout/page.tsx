import { NextIntlClientProvider } from 'next-intl'
import { messagesFor, type Messages } from '@/i18n/messages'
import { ReviewCards } from './ReviewCards'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const es = (await searchParams).lang === 'es'
  const body = <ReviewCards />
  return (
    <main className="max-w-xl mx-auto p-6 space-y-6 bg-zinc-50">
      <p className="text-xs text-gray-500">Review build only: buyout cards ({es ? 'es' : 'en'}), nothing is saved.</p>
      {es ? (
        <NextIntlClientProvider locale="es" messages={messagesFor('es') as Messages} timeZone="America/Chicago">
          {body}
        </NextIntlClientProvider>
      ) : (
        body
      )}
    </main>
  )
}
