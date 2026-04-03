import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CloseOpenRequestButton } from './CloseOpenRequestButton'
import { RequestWebsiteForm } from './RequestWebsiteForm'

type Props = {
  searchParams: Promise<{ focus?: string }>
}

export default async function RequestWebsitePage({ searchParams }: Props) {
  const q = await searchParams
  const focusMaintenance = q.focus === 'maintenance'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let openRequestStatus: 'submitted' | 'in_review' | null = null
  if (user) {
    const { data: open } = await supabase
      .from('website_requests')
      .select('status')
      .eq('user_id', user.id)
      .in('status', ['submitted', 'in_review'])
      .maybeSingle()
    if (open?.status === 'submitted' || open?.status === 'in_review') {
      openRequestStatus = open.status
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Request a website</h1>
      <p className="text-gray-600 mb-8 max-w-2xl">
        Share your local business details. We evaluate every request in person, by email, or
        phone. After we review your Google Business presence and scope, we will follow up with
        next steps.
      </p>
      {openRequestStatus ? (
        <div className="mb-8 max-w-lg rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-sm font-medium text-amber-950 mb-2">You have an open request</p>
          <CloseOpenRequestButton status={openRequestStatus} />
        </div>
      ) : null}
      <RequestWebsiteForm focusMaintenance={focusMaintenance} />
      <p className="mt-8 text-sm text-gray-500">
        <Link href="/dashboard" className="text-[#ba3d3d] hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  )
}
