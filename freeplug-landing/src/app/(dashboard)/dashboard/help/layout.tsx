import { HelpChat } from '@/components/help/HelpChat'
import { createClient } from '@/lib/supabase/server'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { ladderCopy } from '@/lib/plans/ladder-copy'
import { currentLocale } from '@/i18n/current-locale'
import { sendHelpChangeRequest } from '../request-website/actions'

/**
 * Help page shell: the scripted help chat (Sable's Sep 25 spec) sits above the help center.
 * The help center page itself is a client component, so the server data is loaded here.
 */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const { starterSmallEditAddonLine } = ladderCopy(await currentLocale())
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasIncludedEdit = false
  // Starter without the +1 small edit add-on: the review step points to the add-on (Sable, Oct 4).
  let smallEditAddonNote: string | null = null
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()
    if (prof?.stripe_customer_id) {
      try {
        const ent = (await getUserEntitlements(supabase, user.id, prof.stripe_customer_id)).entitlements
        hasIncludedEdit = ent.includedEditsPerMonth > 0
        if (!hasIncludedEdit && !ent.legacy && ent.step?.id === 'starter' && !ent.addons.includes('small_edit')) smallEditAddonNote = starterSmallEditAddonLine()
      } catch (e) {
        // Only hides the optional included-edit note; the chat still works.
        console.error('[help] entitlements lookup failed', e instanceof Error ? e.message : e)
      }
    }
  }

  return (
    <div className="space-y-8">
      <HelpChat
        email={user?.email ?? ''}
        hasIncludedEdit={hasIncludedEdit}
        smallEditAddonNote={smallEditAddonNote}
        sendRequest={sendHelpChangeRequest}
      />
      {children}
    </div>
  )
}
