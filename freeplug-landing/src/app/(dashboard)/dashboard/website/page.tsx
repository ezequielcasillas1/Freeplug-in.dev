import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { customerScreenshotUrls } from '@/lib/outreach/server'
import { ScreenshotPicture } from '@/components/outreach/ScreenshotPicture'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('websiteTitle'), robots: { index: false, follow: false } }
}
export const dynamic = 'force-dynamic'

/** "View my preview" before launch: the same screenshots as the preview page (signed URLs). */
export default async function WebsitePreviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const shots = await customerScreenshotUrls(user.id)
  if (!shots || (!shots.desktop && !shots.mobile)) notFound()
  const t = await getTranslations('claim')
  const heading = t('yourWebsiteHeading')
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{heading}</h1>
      <p className="text-sm text-gray-500 mb-4">{t('screenshotNote').split('. ')[0]}.</p>
      <ScreenshotPicture desktop={shots.desktop} mobile={shots.mobile} alt={heading} />
    </div>
  )
}
