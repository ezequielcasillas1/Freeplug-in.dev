import type { Metadata } from 'next'
import Link from 'next/link'
import { LINK_EXPIRED_MESSAGE } from '@/lib/auth/link-expired'

export const metadata: Metadata = {
  title: 'Link expired | Freeplug',
  robots: { index: false, follow: false },
}

const BACK = {
  reset: { href: '/forgot-password', label: 'Request a new reset link' },
  claim: { href: '/login?next=/claim', label: 'Back to log in' },
  account: { href: '/login', label: 'Back to log in' },
} as const

type Props = { searchParams: Promise<{ for?: string }> }

export default async function LinkExpiredPage({ searchParams }: Props) {
  const q = await searchParams
  const back = q.for === 'reset' ? BACK.reset : q.for === 'claim' ? BACK.claim : BACK.account
  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Link expired</h1>
      <p className="mb-6 text-sm text-gray-700" role="status">
        {LINK_EXPIRED_MESSAGE}
      </p>
      <Link
        href={back.href}
        className="inline-flex w-full items-center justify-center rounded-lg bg-[#ba3d3d] px-4 py-3 font-medium text-white hover:bg-[#a33535] transition-colors"
      >
        {back.label}
      </Link>
    </div>
  )
}
