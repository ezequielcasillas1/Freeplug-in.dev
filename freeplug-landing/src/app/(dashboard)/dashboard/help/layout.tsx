import { HelpChat } from '@/components/help/HelpChat'
import { createClient } from '@/lib/supabase/server'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { editsCopy } from '@/lib/plans/edits-copy'
import { ladderCopy } from '@/lib/plans/ladder-copy'
import { currentLocale } from '@/i18n/current-locale'
import { sendHelpChangeRequest } from '../request-website/actions'

/**
 * Help page shell: the scripted help chat (Sable's Sep 25 spec) sits above the help center.
 * The help center page itself is a client component, so the server data is loaded here.
 */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale()
  const { starterSmallEditAddonLine } = ladderCopy(locale)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasIncludedEdit = false
  // Oct 18: ladder plans (not unlimited) get the small-edit answer + "Go to Plans" (edit pack) in the review step.
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
        if (ent.legacy) hasIncludedEdit = ent.includedEditsPerMonth > 0
        else if (ent.step && Number.isFinite(ent.includedEditsPerMonth)) smallEditAddonNote = editsCopy(locale).helpSmallEditAnswer
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
