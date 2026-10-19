import type { Metadata } from 'next'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { recipientFromParams } from '@/lib/unsubscribe/token'
import { UnsubscribeForm } from './UnsubscribeForm'
import { UNSUBSCRIBE_COPY as C } from './copy'

export const metadata: Metadata = { title: 'Unsubscribe | Freeplug', robots: { index: false } }
export const dynamic = 'force-dynamic'

/** Oct 19: confirm page for the cold-email unsubscribe link (?t=signed token only). Same shell as the 404. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams
  const who = await recipientFromParams(sp)
  return (
    <>
      <Navigation />
      <main className="relative min-h-[70vh] overflow-hidden bg-gradient-to-b from-white to-zinc-50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">{C.heading}</h1>
          {who ? (
            <UnsubscribeForm email={who.email} t={sp.t!} />
          ) : (
            <p className="text-lg text-gray-700" data-testid="unsubscribe-invalid">{C.invalid}</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
