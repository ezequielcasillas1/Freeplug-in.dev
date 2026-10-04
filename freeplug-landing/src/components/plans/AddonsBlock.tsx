'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { ADDONS, COMING_SOON_ADDONS, entitlementsFor, type AddonDef, type AddonId, type PlanStepId } from '@/lib/plans/ladder'
import type { AddonPreviewResponse, ChangeAddonResponse } from '@/app/(dashboard)/dashboard/billing-actions'
import {
  ADDON_CANCEL,
  ADDON_ERROR,
  ADDON_KEEP,
  ADDON_NAMES,
  ADDON_TURN_OFF,
  ADDON_TURN_ON,
  ADDONS_HEADING,
  ADDONS_LEGACY_NOTE,
  ADDONS_LOCKED_BY_REMOVAL,
  ADDONS_STARTER_CAP_NOTE,
  BIG_CHANGE_BIGGER_NOTE,
  COMING_SOON_LABEL,
  UPGRADE_CALCULATING,
  addonChargeNote,
  addonChargeNowLine,
  addonEndsLine,
  addonOffQuestion,
  addonPerkLine,
  addonPriceLine,
  addonsLockedBySwitch,
  addonThenLine,
  addonTipDropQuestion,
  addonTurnOnQuestion,
} from '@/lib/plans/ladder-copy'

/** New checkout: the picks live in the card's state; the server re-checks every one (cap, tip max). */
type CheckoutProps = {
  mode: 'checkout'
  selected: AddonId[]
  tipDollars: number
  /** The tip max with these add-ons on (null = no tip on this step). The ONE cap rule lives in tips.ts. */
  maxTipFor: (ids: AddonId[]) => number | null
  /** New picks + the tip to keep (lower than now only after the customer confirmed the drop). */
  onChange: (ids: AddonId[], tipDollars: number) => void
  disabled?: boolean
}

/** Live plan: every switch goes through the server (preview -> confirm -> change). */
type LiveProps = {
  mode: 'live'
  current: AddonId[]
  /** On now, set to end at `endDate` (a planned removal). */
  ending: AddonId[]
  endDate: string | null
  /** A step switch is planned: no add-on changes until it happens (or "keep my plan"). */
  lockedBySwitchDate?: string | null
  lockedBySwitch?: boolean
  /** Grandfathered plan: the note only. */
  legacy?: boolean
  onPreview: (addonId: AddonId, action: 'on' | 'off') => Promise<AddonPreviewResponse>
  onChange: (addonId: AddonId, action: 'on' | 'off' | 'keep', opts?: { prorationDate?: number; tipDropTo?: number }) => Promise<ChangeAddonResponse>
}

type Props = { stepId: PlanStepId; className?: string } & (CheckoutProps | LiveProps)

type Pending =
  | { id: AddonId; kind: 'loading' }
  | {
      id: AddonId
      kind: 'confirm' | 'submitting'
      action: 'on' | 'off'
      question: string
      lines: string[]
      button: string
      prorationDate?: number
      tipDropTo?: number
      /** checkout: the picks and tip to apply on confirm */
      apply?: { ids: AddonId[]; tip: number }
    }

const ON_CARD = 'border-[#ba3d3d] ring-1 ring-[#ba3d3d] bg-[#ba3d3d]/5'
const OFF_CARD = 'border-gray-200 bg-white'

/**
 * Add-ons block (Lina's approved spec, Oct 4): under the step list on every step, before the tip.
 * Three cards (one row of 3 from sm, stacked on phones): +1 small edit and Big change are switches
 * (the whole card is the >= 44px tap target; on = brand border + tint), Visitor snapshot is Coming
 * soon (amber badge, no switch). Never lowers a tip silently: when turning one on would push
 * Starter past its total, an inline confirm opens under that card ("Your tip will drop to $X. Turn
 * on <Add-on>?" [Turn on] Cancel); focus moves to Turn on and Esc cancels. Live plans confirm every
 * change with the server's numbers (full price now; removal at period end).
 */
export function AddonsBlock(props: Props) {
  const { stepId, className } = props
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keeping, setKeeping] = useState<AddonId | null>(null)
  const turnOnRef = useRef<HTMLButtonElement>(null)
  const cardRefs = useRef<Partial<Record<AddonId, HTMLElement | null>>>({})
  // Stale-request guard (as in HostingCheckoutCard): closing bumps it, a late preview is dropped.
  const previewSeq = useRef(0)
  useEffect(
    () => () => {
      previewSeq.current++
    },
    []
  )

  const close = useCallback((focusId?: AddonId) => {
    previewSeq.current++
    setPending(null)
    if (focusId) setTimeout(() => cardRefs.current[focusId]?.focus(), 0)
  }, [])

  // Focus + Esc in the same commit that shows the confirm (Vera, aaec23d finding 2 pattern).
  const pendingKind = pending?.kind ?? null
  const pendingId = pending?.id ?? null
  useLayoutEffect(() => {
    if (pendingKind !== 'confirm' && pendingKind !== 'loading') return
    if (pendingKind === 'confirm') turnOnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(pendingId ?? undefined)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pendingKind, pendingId, close])

  const withIncludedEdit = entitlementsFor({ stepId }).includedEditsPerMonth >= 1
  const submitting = pending?.kind === 'submitting' || keeping !== null

  // ------------------------------------------------------------------ checkout
  function toggleCheckout(p: CheckoutProps, addon: AddonDef) {
    if (p.disabled || submitting) return
    setError(null)
    const on = p.selected.includes(addon.id)
    if (on) {
      if (pending?.id === addon.id) close()
      p.onChange(
        p.selected.filter((a) => a !== addon.id),
        p.tipDollars
      )
      return
    }
    const next = [...p.selected, addon.id]
    const max = p.maxTipFor(next)
    if (max !== null && p.tipDollars > max) {
      previewSeq.current++
      setPending({
        id: addon.id,
        kind: 'confirm',
        action: 'on',
        question: addonTipDropQuestion(max, ADDON_NAMES[addon.id]),
        lines: [],
        button: ADDON_TURN_ON,
        apply: { ids: next, tip: max },
      })
      return
    }
    if (pending) close()
    p.onChange(next, p.tipDollars)
  }

  // ------------------------------------------------------------------ live
  async function toggleLive(p: LiveProps, addon: AddonDef) {
    if (submitting) return
    setError(null)
    setNotice(null)
    const action: 'on' | 'off' = p.current.includes(addon.id) ? 'off' : 'on'
    const seq = ++previewSeq.current
    setPending({ id: addon.id, kind: 'loading' })
    let r: AddonPreviewResponse
    try {
      r = await p.onPreview(addon.id, action)
    } catch {
      if (seq !== previewSeq.current) return
      setPending(null)
      setError(ADDON_ERROR)
      return
    }
    if (seq !== previewSeq.current) return
    if (!r.ok) {
      setPending(null)
      setError(r.message)
      return
    }
    const name = ADDON_NAMES[addon.id]
    if (r.action === 'on') {
      const drop = r.tipDollarsAfter < r.tipDollarsNow
      setPending({
        id: addon.id,
        kind: 'confirm',
        action: 'on',
        question: drop ? addonTipDropQuestion(r.tipDollarsAfter, name) : addonTurnOnQuestion(name),
        lines: [addonChargeNowLine(r.amountDueCents), addonThenLine(r.nextAmountCents, r.nextDate)],
        button: ADDON_TURN_ON,
        prorationDate: r.prorationDate,
        ...(drop ? { tipDropTo: r.tipDollarsAfter } : {}),
      })
      return
    }
    setPending({ id: addon.id, kind: 'confirm', action: 'off', question: addonOffQuestion(name, r.endDate), lines: [], button: ADDON_TURN_OFF })
  }

  async function confirmLive(p: LiveProps) {
    if (!pending || pending.kind !== 'confirm') return
    const cur = pending
    setPending({ ...cur, kind: 'submitting' })
    try {
      const r = await p.onChange(cur.id, cur.action, { prorationDate: cur.prorationDate, tipDropTo: cur.tipDropTo })
      if (r.ok) {
        setNotice(r.message)
        close(cur.id)
        return
      }
      if (r.code === 'tip_drop_needed' && typeof r.tipDollars === 'number') {
        // The tip changed since the preview: ask again with the server's number (never silent).
        setPending({ ...cur, kind: 'confirm', question: addonTipDropQuestion(r.tipDollars, ADDON_NAMES[cur.id]), tipDropTo: r.tipDollars })
        return
      }
      setError(r.message)
    } catch {
      setError(ADDON_ERROR)
    }
    close(cur.id)
  }

  async function keepLive(p: LiveProps, id: AddonId) {
    if (submitting) return
    setError(null)
    setNotice(null)
    close()
    setKeeping(id)
    try {
      const r = await p.onChange(id, 'keep')
      if (r.ok) setNotice(r.message)
      else setError(r.message)
    } catch {
      setError(ADDON_ERROR)
    } finally {
      setKeeping(null)
    }
  }

  function onConfirm() {
    if (!pending || pending.kind !== 'confirm') return
    if (props.mode === 'checkout') {
      const apply = pending.apply
      const id = pending.id
      close(id)
      if (apply) props.onChange(apply.ids, apply.tip)
      return
    }
    void confirmLive(props)
  }

  // ------------------------------------------------------------------ render
  const lockedBySwitch = props.mode === 'live' && Boolean(props.lockedBySwitch)
  const removalPending = props.mode === 'live' && props.ending.length > 0
  const lockNote = lockedBySwitch
    ? addonsLockedBySwitch(props.mode === 'live' ? (props.lockedBySwitchDate ?? null) : null)
    : removalPending
      ? ADDONS_LOCKED_BY_REMOVAL
      : null

  function cardText(addon: AddonDef | { id: 'visitor_snapshot'; monthlyCents: number }, muted: boolean) {
    return (
      <span className="block min-w-0 flex-1 text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn('font-semibold', muted ? 'text-gray-600' : 'text-gray-900')}>{ADDON_NAMES[addon.id]}</span>
          <span className={cn('shrink-0 whitespace-nowrap text-sm font-semibold', muted ? 'text-gray-600' : 'text-gray-900')}>{addonPriceLine(addon.monthlyCents)}</span>
        </span>
        <span className="mt-1 block text-sm text-gray-600" data-testid="addon-perk">
          {addonPerkLine(addon.id, { withIncludedEdit })}
        </span>
        {addon.id === 'big_change' ? (
          <span className="mt-1 block text-xs text-gray-500" data-testid="addon-bigger-note">
            {BIG_CHANGE_BIGGER_NOTE}
          </span>
        ) : null}
        {/* Sable (Oct 4): the charge note is for an add-on turned on on a live plan, not at checkout. */}
        {props.mode === 'live' && addon.id !== 'visitor_snapshot' ? (
          <span className="mt-1 block text-xs text-gray-500" data-testid="addon-charge-note">
            {addonChargeNote(addon.monthlyCents)}
          </span>
        ) : null}
      </span>
    )
  }

  function knob(on: boolean) {
    return (
      <span aria-hidden="true" className={cn('relative mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-full transition-colors', on ? 'bg-[#ba3d3d]' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[1.125rem]' : 'left-0.5')} />
      </span>
    )
  }

  function confirmBox(id: AddonId) {
    if (!pending || pending.id !== id) return null
    if (pending.kind === 'loading') {
      return (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-600" data-testid="addon-calculating">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          {UPGRADE_CALCULATING}
        </p>
      )
    }
    return (
      <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-3" data-testid="addon-confirm" data-addon={id}>
        <p className="text-sm text-gray-900" aria-hidden="true">
          {pending.question}
        </p>
        {pending.lines.map((l) => (
          <p key={l} className="mt-1 text-sm text-gray-600" aria-hidden="true">
            {l}
          </p>
        ))}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            ref={turnOnRef}
            size="sm"
            className="min-h-[44px] w-full sm:w-auto"
            onClick={onConfirm}
            disabled={pending.kind === 'submitting'}
            data-testid="addon-confirm-button"
          >
            {pending.kind === 'submitting' ? <Loader2 className="animate-spin" size={18} aria-label={pending.button} /> : pending.button}
          </Button>
          <button
            type="button"
            className="min-h-[44px] w-full text-sm font-medium text-gray-700 underline underline-offset-2 sm:w-auto sm:px-2"
            onClick={() => close(id)}
            disabled={pending.kind === 'submitting'}
            data-testid="addon-cancel"
          >
            {ADDON_CANCEL}
          </button>
        </div>
      </div>
    )
  }

  function liveCard(addon: AddonDef) {
    const isOn = props.mode === 'checkout' ? props.selected.includes(addon.id) : props.current.includes(addon.id)
    const isEnding = props.mode === 'live' && props.ending.includes(addon.id)
    if (isEnding) {
      // On until the end date; "Keep it" undoes the removal (not a switch: one clear action).
      return (
        <div className={cn('flex min-h-[44px] items-start gap-3 rounded-lg border p-4', ON_CARD)} data-addon={addon.id} data-on="true" data-ending="true">
          {cardText(addon, false)}
          <span className="sr-only">{addonEndsLine(props.mode === 'live' ? props.endDate : null)}</span>
        </div>
      )
    }
    const disabled =
      (props.mode === 'checkout' && Boolean(props.disabled)) ||
      lockedBySwitch ||
      (removalPending && !isOn) ||
      submitting
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={`${ADDON_NAMES[addon.id]}, ${addonPriceLine(addon.monthlyCents)}`}
        ref={(el) => {
          cardRefs.current[addon.id] = el
        }}
        disabled={disabled}
        onClick={() => (props.mode === 'checkout' ? toggleCheckout(props, addon) : void toggleLive(props, addon))}
        className={cn(
          'flex min-h-[44px] w-full items-start gap-3 rounded-lg border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d]',
          isOn ? ON_CARD : OFF_CARD,
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
        data-addon={addon.id}
        data-on={isOn ? 'true' : 'false'}
        data-testid={`addon-switch-${addon.id}`}
      >
        {cardText(addon, false)}
        {knob(isOn)}
      </button>
    )
  }

  if (props.mode === 'live' && props.legacy) {
    return (
      <section className={cn('mb-6', className)} aria-labelledby="addons-heading" data-testid="addons-block">
        <h4 id="addons-heading" className="text-sm font-semibold text-gray-900">
          {ADDONS_HEADING}
        </h4>
        <p className="mt-1 text-sm text-gray-600" data-testid="addons-legacy">
          {ADDONS_LEGACY_NOTE}
        </p>
      </section>
    )
  }

  return (
    <section className={cn('mb-6', className)} aria-labelledby="addons-heading" data-testid="addons-block">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 id="addons-heading" className="text-sm font-semibold text-gray-900">
          {ADDONS_HEADING}
        </h4>
        {stepId === 'starter' ? (
          <span className="text-xs text-gray-500" data-testid="addons-cap-note">
            {ADDONS_STARTER_CAP_NOTE}
          </span>
        ) : null}
      </div>
      {lockNote ? (
        <p className="mb-2 text-sm text-gray-600" data-testid="addons-lock-note">
          {lockNote}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only" data-testid="addons-live">
        {pending?.kind === 'loading' ? UPGRADE_CALCULATING : pending ? [pending.question, ...pending.lines].join(' ') : (notice ?? '')}
      </p>
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {ADDONS.map((addon) => {
          const isEnding = props.mode === 'live' && props.ending.includes(addon.id)
          return (
            <div key={addon.id} className="flex flex-col">
              {liveCard(addon)}
              {isEnding && props.mode === 'live' ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-gray-700" data-testid="addon-ending">
                  <span>{addonEndsLine(props.endDate)}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="min-h-[44px] font-medium text-[#ba3d3d] underline underline-offset-2 disabled:opacity-50"
                    onClick={() => void keepLive(props, addon.id)}
                    disabled={submitting || lockedBySwitch}
                    data-testid={`addon-keep-${addon.id}`}
                  >
                    {keeping === addon.id ? <Loader2 className="inline animate-spin" size={16} aria-label={ADDON_KEEP} /> : ADDON_KEEP}
                  </button>
                </div>
              ) : null}
              {confirmBox(addon.id)}
            </div>
          )
        })}
        {COMING_SOON_ADDONS.map((a) => (
          <div
            key={a.id}
            className="flex min-h-[44px] items-start gap-3 rounded-lg border border-gray-200 bg-zinc-50/60 p-4 text-sm"
            data-addon={a.id}
            data-testid="addon-coming-soon"
          >
            <span className="block min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-gray-600">{ADDON_NAMES[a.id]}</span>
                <span className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{COMING_SOON_LABEL}</span>
              </span>
              <span className="mt-1 block text-sm text-gray-600">{addonPriceLine(a.monthlyCents)}</span>
              <span className="mt-1 block text-sm text-gray-600">{addonPerkLine(a.id)}</span>
            </span>
          </div>
        ))}
      </div>
      {notice ? (
        <p className="mt-2 text-sm text-green-700" data-testid="addons-notice">
          {notice}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
