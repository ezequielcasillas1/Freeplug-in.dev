import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { customerPhotosUsed } from '@/lib/outreach/server'
import { getTranslations } from 'next-intl/server'
import { DashboardPhotoUploader } from './DashboardPhotoUploader'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('photosTitle') }
}
export const dynamic = 'force-dynamic'

export default async function PhotosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const t = await getTranslations('claim')
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('uploadPhotosLabel')}</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <DashboardPhotoUploader photosUsed={await customerPhotosUsed(user.id)} />
      </div>
    </div>
  )
}
