import { HelpChat } from '@/components/help/HelpChat'
import { createClient } from '@/lib/supabase/server'
import { hasMonthlyEditAddon } from '@/lib/stripe/active-subscription'
import { sendHelpChangeRequest } from '../request-website/actions'

/**
 * Help page shell: the scripted help chat (Sable's Sep 25 spec) sits above the help center.
 * The help center page itself is a client component, so the server data is loaded here.
 */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasMonthlyEdit = false
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()
    if (prof?.stripe_customer_id) {
      try {
        hasMonthlyEdit = await hasMonthlyEditAddon(prof.stripe_customer_id)
      } catch (e) {
        // Only hides the optional Plus/Pro note; the chat still works.
        console.error('[help] add-on lookup failed', e instanceof Error ? e.message : e)
      }
    }
  }

  return (
    <div className="space-y-8">
      <HelpChat
        email={user?.email ?? ''}
        hasMonthlyEdit={hasMonthlyEdit}
        sendRequest={sendHelpChangeRequest}
      />
      {children}
    </div>
  )
}
