'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { adminBanUser, adminDeleteUser, adminUnbanUser } from './actions'

export type AuthUserRowView = {
  id: string
  email: string | undefined
  created_at: string
  banned_until: string | null | undefined
}

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  return new Date(bannedUntil) > new Date()
}

export function AdminAccountsTable({ users }: { users: AuthUserRowView[] }) {
  if (users.length === 0) {
    return <p className="text-zinc-600 text-sm">No Auth users returned.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
          <tr>
            <th className="p-3 font-medium">Email</th>
            <th className="p-3 font-medium">User id</th>
            <th className="p-3 font-medium">Created</th>
            <th className="p-3 font-medium">Ban</th>
            <th className="p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <AdminAccountRow key={u.id} user={u} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AdminAccountRow({ user }: { user: AuthUserRowView }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const banned = isBanned(user.banned_until)

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="p-3 break-all max-w-[200px]">{user.email ?? '—'}</td>
      <td className="p-3 font-mono text-[10px] text-zinc-500 break-all max-w-[120px]">
        {user.id}
      </td>
      <td className="p-3 text-zinc-600 whitespace-nowrap text-xs">
        {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
      </td>
      <td className="p-3">
        {banned ? (
          <span className="text-xs font-medium text-red-700">Banned</span>
        ) : (
          <span className="text-xs text-zinc-500">Active</span>
        )}
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          {banned ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Unban ${user.email ?? user.id}?`)) return
                startTransition(async () => {
                  const r = await adminUnbanUser(user.id)
                  if (r.ok) router.refresh()
                })
              }}
              className="text-xs font-semibold px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
            >
              Unban
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `Ban ${user.email ?? user.id}? They cannot sign in until unbanned.`
                  )
                )
                  return
                startTransition(async () => {
                  const r = await adminBanUser(user.id)
                  if (r.ok) router.refresh()
                })
              }}
              className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-950 hover:bg-amber-200 disabled:opacity-50"
            >
              Ban
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  `Permanently delete ${user.email ?? user.id}? This removes Auth + cascades profile, requests, ledger (per DB FKs). Cannot be undone.`
                )
              )
                return
              startTransition(async () => {
                const r = await adminDeleteUser(user.id)
                if (r.ok) router.refresh()
              })
            }}
            className="text-xs font-semibold px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
