import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { customerPhotosUsed } from '@/lib/outreach/server'
import { UPLOAD_PHOTOS_LABEL } from '@/lib/outreach/copy'
import { DashboardPhotoUploader } from './DashboardPhotoUploader'

export const metadata: Metadata = { title: 'Upload photos | Freeplug' }
export const dynamic = 'force-dynamic'

export default async function PhotosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{UPLOAD_PHOTOS_LABEL}</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <DashboardPhotoUploader photosUsed={await customerPhotosUsed(user.id)} />
      </div>
    </div>
  )
}
