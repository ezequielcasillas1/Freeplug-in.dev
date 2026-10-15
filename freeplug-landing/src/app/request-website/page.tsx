import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Pattern title (no locked title yet); pending Sable's review.
export const metadata: Metadata = {
  title: 'Request a website | Freeplug',
}

type Props = {
  searchParams: Promise<{ focus?: string }>
}

export default async function RequestWebsiteEntryPage({ searchParams }: Props) {
  const q = await searchParams
  const dash =
    q.focus === 'maintenance'
      ? '/dashboard/request-website?focus=maintenance'
      : '/dashboard/request-website'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginNext = encodeURIComponent(dash)
    redirect(`/login?next=${loginNext}`)
  }

  redirect(dash)
}
