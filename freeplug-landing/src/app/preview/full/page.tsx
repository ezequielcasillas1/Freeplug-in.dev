import { notFound } from 'next/navigation'
import { ScreenshotPicture } from '@/components/outreach/ScreenshotPicture'
import { currentPreviewSite, screenshotUrlsFor } from '@/lib/outreach/server'

export const dynamic = 'force-dynamic'

/** "Open full screen": the screenshot on its own page, behind the same link check. */
export default async function PreviewFullPage() {
  const site = await currentPreviewSite()
  if (!site) notFound()
  const shots = await screenshotUrlsFor(site)
  return (
    <main className="min-h-screen bg-zinc-100">
      <ScreenshotPicture desktop={shots.desktop} mobile={shots.mobile} alt={site.business_name} />
    </main>
  )
}
