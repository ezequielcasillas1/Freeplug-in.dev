'use client'

import { useTransition } from 'react'
import { adminSetWebsiteRequestStatus } from './actions'
import { AdminQuickEmail } from './AdminQuickEmail'

export type AdminRequestRowData = {
  id: string
  user_id: string
  business_name: string
  contact_phone: string | null
  google_business_url: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
  userEmail: string | null
  userDisplayName: string | null
}

const STATUSES = ['submitted', 'in_review', 'closed'] as const

export function AdminRequestRow({
  row,
  smtpConfigured,
}: {
  row: AdminRequestRowData
  smtpConfigured: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="p-3 text-zinc-600 whitespace-nowrap">
        {new Date(row.created_at).toLocaleString()}
      </td>
      <td className="p-3 font-medium text-zinc-900">{row.business_name}</td>
      <td className="p-3">
        <select
          className="border border-zinc-300 rounded-md px-2 py-1 text-sm bg-white disabled:opacity-50"
          disabled={pending}
          value={row.status}
          onChange={(e) => {
            const v = e.target.value as (typeof STATUSES)[number]
            startTransition(async () => {
              await adminSetWebsiteRequestStatus(row.id, v)
            })
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <AdminQuickEmail to={row.userEmail} smtpConfigured={smtpConfigured} />
      </td>
      <td className="p-3 text-zinc-700 text-sm max-w-[120px] break-words">
        {row.userDisplayName ?? '—'}
      </td>
      <td className="p-3 font-mono text-[10px] text-zinc-500 break-all max-w-[100px]">
        {row.user_id}
      </td>
      <td className="p-3 text-zinc-700 max-w-[160px] break-words">
        {row.contact_phone ?? '—'}
        {row.google_business_url ? (
          <a
            href={row.google_business_url}
            target="_blank"
            rel="noreferrer"
            className="block text-[#ba3d3d] hover:underline truncate mt-1"
          >
            Google link
          </a>
        ) : null}
      </td>
      <td className="p-3 text-zinc-600 max-w-[200px] whitespace-pre-wrap break-words text-xs">
        {row.notes?.trim() ? row.notes : '—'}
      </td>
    </tr>
  )
}
