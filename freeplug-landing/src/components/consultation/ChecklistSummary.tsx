import { checklistSummaryRows, type Checklist } from '@/lib/consultation/checklist'

export function ChecklistSummary({ checklist }: { checklist: Checklist }) {
  const rows = checklistSummaryRows(checklist)
  if (rows.length === 0) return <p className="text-sm text-gray-600">No answers yet.</p>
  return (
    <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white" data-testid="checklist-summary">
      {rows.map((r) => (
        <div key={r.label} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
          <dt className="text-sm font-medium text-gray-500">{r.label}</dt>
          <dd className="text-sm text-gray-900 sm:col-span-2 whitespace-pre-wrap break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
