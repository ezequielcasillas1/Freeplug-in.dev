import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/app/(dashboard)/DashboardNav'
import { DashboardHeader } from '@/app/(dashboard)/DashboardHeader'
import { DashboardFooter } from '@/app/(dashboard)/DashboardFooter'
import { AppTreeDocument } from '@/app/app-document-server'

/** Private pages: keep out of search results. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('dashboardTitle'), robots: { index: false } }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  return (
    <AppTreeDocument>
    <div className="min-h-screen bg-zinc-50">
      <DashboardHeader email={user.email} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <DashboardNav />
        {children}
      </main>
      <DashboardFooter />
    </div>
    </AppTreeDocument>
  )
}
