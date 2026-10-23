import Link from 'next/link'
import type { Metadata } from 'next'
import { assertAdminAccess } from '@/lib/admin/guard'
import { AdminNav } from './AdminNav'
import { AppDocument } from '@/app/AppDocument'
import { EN_MESSAGES } from '@/i18n/messages'

/** Read `SUPABASE_SERVICE_ROLE_KEY` at request time (not at static prerender). */
export const dynamic = 'force-dynamic'

/** Private pages: keep out of search results. */
export const metadata: Metadata = {
  title: 'Dashboard | Freeplug',
  robots: { index: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await assertAdminAccess()
  // Admin stays English (card R3), whatever the admin's own language preference is.
  return (
    <AppDocument lang="en" messages={EN_MESSAGES}>
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/requests" className="flex items-center gap-2 text-lg font-semibold text-[#ba3d3d] w-fit">
            {/* FP mark (Oct 22 2026). Plain img: keeps /_next/image off Cloudflare Images. */}
            <img src="/images/brand/fp-logo-64.png" alt="" width={28} height={28} className="w-7 h-7 shrink-0 rounded-full" />
            Admin (local)
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
    </AppDocument>
  )
}
