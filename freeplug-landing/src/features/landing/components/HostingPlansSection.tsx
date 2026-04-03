import { createClient } from '@/lib/supabase/server'
import { isPlansCheckoutAllowed } from '@/lib/dashboard/plans-eligibility'
import { HostingPlansSectionUi } from './HostingPlansSectionUi'

export async function HostingPlansSection() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const signedIn = !!user
  const hostingCheckoutAllowed = user
    ? await isPlansCheckoutAllowed(supabase, user.id)
    : false

  return (
    <HostingPlansSectionUi
      signedIn={signedIn}
      hostingCheckoutAllowed={hostingCheckoutAllowed}
    />
  )
}
