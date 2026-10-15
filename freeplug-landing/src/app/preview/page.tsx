import { notFound } from 'next/navigation'
import { PreviewView } from '@/components/outreach/PreviewView'
import { getPreviewPageData } from '@/lib/outreach/server'
import { NOT_NOW_CONFIRM, fill, formatExpiryDate } from '@/lib/outreach/copy'

export const dynamic = 'force-dynamic'

/**
 * The private preview (after /p/<token> set the signed cookie). Unknown, expired, revoked and
 * claimed links all get the same 404 page, which never names the business.
 */
export default async function PreviewPage() {
  const data = await getPreviewPageData()
  if (!data) notFound()
  return (
    <PreviewView
      businessName={data.businessName}
      declinedMessage={data.declined ? fill(NOT_NOW_CONFIRM, { 'expiry date': formatExpiryDate(new Date(data.expiresAt)) }) : null}
      prefill={data.prefill}
      services={data.services}
      screenshots={data.screenshots}
      photosUsed={data.photosUsed}
    />
  )
}
