'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { QUOTE_BADGE, QUOTE_CONFIRM_SEND_LABEL, QUOTE_SEND_LABEL, QUOTE_VOID_CONFIRM, quoteDueDateText, quoteSendConfirmText, type QuoteStatus } from '@/lib/maintenance-quotes/quotes'
import { adminSaveQuoteDraft, adminSendQuote, adminVoidQuote, type QuoteActionResult } from './quote-actions'

export type RowQuote = { id: string; status: QuoteStatus; amount_cents: number; description: string; sent_at: string | null } | null

/** Row badge in the page's badge style: gray Draft, yellow "Sent, unpaid", green Paid, red Void. */
export function QuoteBadge({ quote }: { quote: RowQuote }) {
  if (!quote) return null
  const b = QUOTE_BADGE[quote.status]
  return (
    <span className={`text-xs font-semibold rounded px-2 py-0.5 ${b.className}`} data-testid="quote-badge" data-quote-status={quote.status}>
      {b.label}
    </span>
  )
}

/**
 * "Quote maintenance" row action: opens the page's panel style with amount, short description and the due
 * date as text (fixed 7 days). Save draft (outlined), Send (filled brand red) with a confirm step, Void link.
 */
export function MaintenanceQuoteControls({ changeRequestId, quote, customerName }: { changeRequestId: string; quote: RowQuote; customerName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmingVoid, setConfirmingVoid] = useState(false)
  const [amount, setAmount] = useState(quote ? String(quote.amount_cents / 100) : '')
  const [description, setDescription] = useState(quote?.description ?? '')
  const [result, setResult] = useState<QuoteActionResult | null>(null)
  const [pending, start] = useTransition()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const live = quote && quote.status !== 'void' ? quote : null
  const editable = !live || live.status === 'draft'

  useEffect(() => {
    if (confirming) titleRef.current?.focus()
  }, [confirming])

  const run = (fn: () => Promise<QuoteActionResult>) =>
    start(async () => {
      const r = await fn()
      setResult(r)
      setConfirming(false)
      setConfirmingVoid(false)
      router.refresh()
    })

  return (
    <div className="mt-2" data-testid="quote-controls">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          className="font-semibold text-[#ba3d3d] hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="quote-maintenance-link"
        >
          Quote maintenance
        </button>
        {live && live.status !== 'paid' ? (
          <button type="button" className="font-semibold text-red-700 hover:underline disabled:opacity-50" disabled={pending || confirmingVoid} aria-expanded={confirmingVoid} onClick={() => setConfirmingVoid(true)} data-testid="quote-void-link">
            Void
          </button>
        ) : null}
      </div>
      {confirmingVoid && live ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={`quote-void-title-${live.id}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmingVoid(false)
          }}
          className="mt-2 rounded-md border border-red-200 bg-red-50 p-3"
          data-testid="quote-void-confirm"
        >
          <p id={`quote-void-title-${live.id}`} className="text-sm font-semibold text-zinc-900">
            {QUOTE_VOID_CONFIRM}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => run(() => adminVoidQuote(live.id))}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="quote-void-yes"
            >
              {pending ? 'Voiding…' : 'Void quote'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingVoid(false)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {!open && result ? (
        result.ok ? (
          <p role="status" className="mt-1 text-sm text-green-800">{result.message}</p>
        ) : (
          <p role="alert" className="mt-1 text-sm text-red-700">{result.error}</p>
        )
      ) : null}
      {open ? (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-3" data-testid="quote-panel">
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">Amount ($50–$100)</span>
            <input
              inputMode="decimal"
              value={amount}
              disabled={!editable || pending}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
              data-testid="quote-amount"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">Short description</span>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              disabled={!editable || pending}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
              data-testid="quote-description"
            />
          </label>
          <p className="text-xs text-zinc-500" data-testid="quote-due">
            {quoteDueDateText(live?.sent_at ? new Date(live.sent_at) : new Date())}
          </p>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => adminSaveQuoteDraft(changeRequestId, amount, description))}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                data-testid="quote-save-draft"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={pending || !live || confirming}
                onClick={() => setConfirming(true)}
                aria-haspopup="true"
                aria-expanded={confirming}
                className="rounded-md bg-[#ba3d3d] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                data-testid="quote-send"
                title={live ? undefined : 'Save a draft first'}
              >
                {QUOTE_SEND_LABEL}
              </button>
            </div>
          ) : null}
          {confirming && live ? (
            <div
              role="alertdialog"
              aria-modal="false"
              aria-labelledby={`quote-confirm-title-${live.id}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setConfirming(false)
              }}
              className="rounded-md border border-amber-300 bg-amber-50 p-3"
              data-testid="quote-confirm"
            >
              <h3 id={`quote-confirm-title-${live.id}`} ref={titleRef} tabIndex={-1} className="text-sm font-semibold text-zinc-900 outline-none">
                {quoteSendConfirmText(customerName, live.amount_cents)}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => adminSendQuote(live.id))}
                  className="rounded-md bg-[#ba3d3d] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  data-testid="quote-confirm-yes"
                >
                  {pending ? 'Sending…' : QUOTE_CONFIRM_SEND_LABEL}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {result ? (
            result.ok ? (
              <p role="status" className="text-sm text-green-800">{result.message}</p>
            ) : (
              <p role="alert" className="text-sm text-red-700">{result.error}</p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
