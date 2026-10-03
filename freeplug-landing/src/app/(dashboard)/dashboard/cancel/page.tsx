import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCancelPageData } from './actions'
import { CancelPlanView } from './CancelPlanView'
import { getClaimedSiteForUser } from '@/lib/outreach/server'
import { outreachCancelBox } from '../outreach-dashboard'

export default async function CancelPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard/cancel')
  }

  // Claimed outreach site first: like the dashboard, its customers never get a 500 from a Stripe
  // error, and they see the outreach plan states instead of the regular "no subscriptions" block.
  const outreachSite = await getClaimedSiteForUser(user.id)
  const data = await getCancelPageData({ tolerateStripeErrors: Boolean(outreachSite) })

  if (!data) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cancel Services</h1>
        <p className="text-gray-600">Unable to load your account information. Please try again.</p>
      </div>
    )
  }

  const { data: openRequest } = await supabase
    .from('website_requests')
    .select('is_buyout')
    .eq('user_id', user.id)
    .in('status', ['submitted', 'in_review'])
    .maybeSingle()

  return (
    <CancelPlanView
      data={data}
      buyoutRequested={openRequest?.is_buyout === true}
      outreachBox={outreachSite ? outreachCancelBox(outreachSite, data) : null}
    />
  )
}
