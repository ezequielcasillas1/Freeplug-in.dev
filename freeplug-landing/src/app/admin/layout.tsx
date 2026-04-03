import Link from 'next/link'
import { assertAdminAccess } from '@/lib/admin/guard'
import { AdminNav } from './AdminNav'

/** Read `SUPABASE_SERVICE_ROLE_KEY` at request time (not at static prerender). */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await assertAdminAccess()
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/requests" className="text-lg font-semibold text-[#ba3d3d] w-fit">
            Admin (local)
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
