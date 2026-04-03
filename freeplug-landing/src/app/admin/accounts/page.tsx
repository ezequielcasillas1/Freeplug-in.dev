import { listAllAuthUsers } from '@/lib/admin/list-auth-users'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminAccountsTable, type AuthUserRowView } from '../AdminAccountsTable'
import { AdminConfigError } from '../AdminConfigError'

export default async function AdminAccountsPage() {
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

  let authUsers: AuthUserRowView[] = []
  let authListError: string | null = null
  try {
    const raw = await listAllAuthUsers(admin)
    authUsers = raw.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      banned_until: u.banned_until,
    }))
  } catch (e) {
    authListError = e instanceof Error ? e.message : String(e)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Accounts (Auth)</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Ban blocks sign-in. Delete removes the Auth user; related rows cascade if your database
        foreign keys use <code className="bg-zinc-100 px-1 rounded text-xs">ON DELETE CASCADE</code>{' '}
        (this project does for profiles and website requests).
      </p>
      {authListError ? (
        <p className="text-red-700 text-sm mb-4">Could not list Auth users: {authListError}</p>
      ) : null}
      <AdminAccountsTable users={authUsers} />
    </div>
  )
}
