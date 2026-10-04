import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { toAppLocale } from '@/i18n/config'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Pattern title (no locked title yet); pending Sable's review. Per locale (public.meta).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.meta' })
  return { title: t('requestWebsiteTitle') }
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
