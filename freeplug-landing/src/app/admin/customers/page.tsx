import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { isSmtpConfigured } from '@/lib/admin/mail'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminConfigError } from '../AdminConfigError'
import { AdminCustomersTable, type CustomerRowView } from '../AdminCustomersTable'
import { AdminSmtpBanner } from '../AdminSmtpBanner'

export default async function AdminCustomersPage() {
  const smtpOn = isSmtpConfigured()

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    const hint =
      process.env.NODE_ENV === 'development'
        ? (e instanceof Error ? e.message : String(e))
        : null
    return <AdminConfigError hint={hint} />
  }

  const { data: profileRows, error: profErr } = await admin
    .from('profiles')
    .select(
      'id, evaluation_status, evaluation_progress, website_value_target_cents, website_transfer_notes, cumulative_website_value_paid_cents, stripe_customer_id, updated_at'
    )
    .order('updated_at', { ascending: false })

  if (profErr) {
    const missingTransferNotes =
      profErr.code === '42703' && profErr.message.includes('website_transfer_notes')

    return (
      <div className="max-w-xl space-y-2">
        <p className="text-red-700 text-sm">{profErr.message}</p>
        {missingTransferNotes ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Database schema is behind the app</p>
            <p className="mt-1 text-amber-900/90">
              In Supabase → SQL Editor, open the repo file{' '}
              <code className="rounded bg-white/80 px-1 text-xs">
                freeplug-landing/supabase/migrations/20260403120000_website_transfer_handoff.sql
              </code>{' '}
              and paste <strong>only that file’s contents</strong> (SQL with{' '}
              <code className="text-xs">alter</code>, <code className="text-xs">create</code>,{' '}
              <code className="text-xs">grant</code>). Do not paste TypeScript (
              <code className="text-xs">import …</code>) — the editor runs Postgres only. Then run
              newer migrations in order (e.g.{' '}
              <code className="rounded bg-white/80 px-1 text-xs">
                20260404100000_close_website_request_rpcs.sql
              </code>
              ). Reload this page after.
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  const profiles = profileRows ?? []
  const authForProfiles = await getAuthSummariesByUserIds(
    admin,
    profiles.map((p) => p.id)
  )

  const customerRows: CustomerRowView[] = profiles.map((p) => {
    const a = authForProfiles.get(p.id)
    return {
      id: p.id,
      email: a?.email ?? null,
      displayName: a?.displayName ?? null,
      evaluation_status: p.evaluation_status,
      evaluation_progress: p.evaluation_progress,
      website_value_target_cents: p.website_value_target_cents,
      website_transfer_notes: p.website_transfer_notes,
      cumulative_website_value_paid_cents: p.cumulative_website_value_paid_cents,
      stripe_customer_id: p.stripe_customer_id,
      updated_at: p.updated_at,
    }
  })

  return (
    <div>
      <AdminSmtpBanner />
      <h2 className="text-xl font-semibold mb-2">Customers (profiles)</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Evaluation status, website value target, cumulative paid (from webhooks), and Stripe
        customer id. Emails are from Auth — same as sign-in address.
      </p>
      <AdminCustomersTable rows={customerRows} smtpConfigured={smtpOn} />
    </div>
  )
}
