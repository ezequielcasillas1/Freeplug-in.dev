'use client'

import { useTransition } from 'react'
import { adminMarkBigChange, adminMarkSmallEdit, adminSetWebsiteRequestStatus } from './actions'
import { ADMIN_MARK_BIG_CHANGE } from '@/lib/plans/ladder-copy'
import { AdminQuickEmail } from './AdminQuickEmail'
import { AdminBuyoutBadge, AdminBuyoutPriceCell } from './AdminBuyoutCell'

export type AdminRequestRowData = {
  id: string
  user_id: string
  business_name: string
  contact_phone: string | null
  google_business_url: string | null
  notes: string | null
  /** Admin-only buyout price (cents); null = not quoted. */
  buyout_price_cents: number | null
  /** Buyout request flag (server-set only). The notes line is never used to detect a buyout. */
  is_buyout: boolean
  status: string
  /** End of next business day for a Fast lane+ small edit (server-set only). */
  due_by?: string | null
  created_at: string
  updated_at: string
  userEmail: string | null
  userDisplayName: string | null
  /** Hosting-ladder step from profiles.plan_step (null = no plan / unknown). */
  planStepId?: string | null
  planStepName?: string | null
  /** Queue rank: 0 Starter .. 5 Growth partner, -1 no plan. */
  priorityRank?: number
}

const STATUSES = ['submitted', 'in_review', 'closed'] as const

export function AdminRequestRow({
  row,
  mailConfigured,
}: {
  row: AdminRequestRowData
  mailConfigured: boolean
}) {
  const [pending, startTransition] = useTransition()
  const buyout = row.is_buyout === true

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="p-3 text-zinc-600 whitespace-nowrap">
        {new Date(row.created_at).toLocaleString()}
        {row.due_by ? (
          <div className="mt-1 text-xs font-medium text-amber-800" data-testid="due-by">
            Due {new Date(row.due_by).toLocaleString()}
          </div>
        ) : null}
      </td>
      <td className="p-3 font-medium text-zinc-900">
        {row.business_name}
        {row.planStepName ? (
          <span
            data-plan-step={row.planStepId ?? undefined}
            className={
              (row.priorityRank ?? -1) >= 1
                ? 'ml-2 rounded bg-[#ba3d3d]/10 px-1 text-[10px] font-semibold text-[#ba3d3d]'
                : 'ml-2 rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-600'
            }
          >
            {row.planStepName}
          </span>
        ) : null}
        {row.status !== 'closed' && (row.priorityRank ?? -1) >= 0 ? (
          <div className="mt-1 flex flex-wrap gap-2 font-normal">
            <button
              type="button"
              disabled={pending}
              className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  const res = await adminMarkSmallEdit(row.id, { useIncludedEdit: false })
                  if (!res.ok) window.alert(res.error)
                })
              }
            >
              Small edit: set due date
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  const res = await adminMarkSmallEdit(row.id, { useIncludedEdit: true })
                  if (!res.ok) window.alert(res.error)
                })
              }
            >
              Use included edit
            </button>
            <button
              type="button"
              disabled={pending}
              data-testid="admin-mark-big-change"
              className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  const res = await adminMarkBigChange(row.id)
                  if (!res.ok) window.alert(res.error)
                })
              }
            >
              {ADMIN_MARK_BIG_CHANGE}
            </button>
          </div>
        ) : null}
        {buyout ? (
          <div className="mt-1 font-normal">
            <AdminBuyoutBadge />
            <AdminBuyoutPriceCell
              requestId={row.id}
              priceCents={row.buyout_price_cents}
            />
          </div>
        ) : null}
      </td>
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
        <AdminQuickEmail to={row.userEmail} mailConfigured={mailConfigured} />
      </td>
      <td className="p-3 text-zinc-700 text-sm max-w-[120px] break-words">
        {row.userDisplayName ?? '—'}
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
