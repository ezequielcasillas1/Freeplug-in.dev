'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Turnstile } from '@/components/turnstile/Turnstile'
import { cn } from '@/lib/utils/cn'
import { CHANGE_REQUEST_COPY, CHANGE_TYPES, type ChangeType } from '@/lib/help/help-chat-content'
import {
  ADD_DETAILS_LABEL,
  CALL_ARIA,
  CALL_US_LABEL,
  CLAIM_LABEL,
  DESKTOP_CONTACT_TEXT,
  DETAILS_HEADING,
  DETAILS_INTRO,
  DETAILS_SUCCESS,
  EMAIL_ARIA,
  EMAIL_US_LABEL,
  NOT_NOW_LABEL,
  OPEN_FULL_SCREEN_LABEL,
  PREVIEW_BANNER_BODY,
  PREVIEW_BANNER_HEADING,
  PREVIEW_CHANGE_SENT,
  PREVIEW_UNDER_MAIN_BUTTON,
  REQUEST_CHANGE_LABEL,
  SCREENSHOT_NOTE,
  SEND_DETAILS_LABEL,
  TEXT_ARIA,
  TEXT_US_LABEL,
  fill,
} from '@/lib/outreach/copy'
import { SUPPORT_MAILTO, SUPPORT_SMS_HREF, SUPPORT_TEL_HREF } from '@/lib/site'
import type { PrefillMap, ServiceItem } from '@/lib/outreach/schemas'
import {
  declinePreviewAction,
  sendPreviewChangeAction,
  sendPreviewDetailsAction,
  uploadPreviewPhotoAction,
} from '@/app/preview/actions'
import { DetailsForm } from './DetailsForm'
import { ScreenshotPicture } from './ScreenshotPicture'

type Panel = 'details' | 'change' | null

export type PreviewViewProps = {
  businessName: string
  declinedMessage: string | null
  prefill: PrefillMap
  services: ServiceItem[]
  screenshots: { desktop: string | null; mobile: string | null }
  photosUsed: number
}

const CARD = 'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm'
const TEXT_LINK = 'text-sm font-semibold text-[#ba3d3d] hover:underline'
const GREY_LINK = 'text-sm text-gray-500 hover:text-gray-700 hover:underline'
/** Phone Call / Text / Email: bordered, never red (Lina, Sep 27). */
const PHONE_CONTACT =
  'flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-gray-800 hover:bg-zinc-50'

/**
 * Exactly one red button on the banner screen (Lina, Sep 27): while a panel with its own red send
 * button is open and not yet sent, "Claim my website" is outline; otherwise Claim is the red one.
 * After "Not right now" Claim stays red too, so there is never zero red buttons.
 */
export function claimIsOutline(panel: Panel, sent: { details: boolean; change: boolean }): boolean {
  return (panel === 'details' && !sent.details) || (panel === 'change' && !sent.change)
}
const INPUT =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none'

function ChangeRequestPanel({ onSent }: { onSent: () => void }) {
  const [changeType, setChangeType] = useState<ChangeType>(CHANGE_TYPES[0])
  const [description, setDescription] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [tsKey, setTsKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  if (done) {
    return (
      <p className="text-sm font-medium text-gray-800" role="status">
        {PREVIEW_CHANGE_SENT}
      </p>
    )
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setPending(true)
        setError(null)
        const res = await sendPreviewChangeAction({ changeType, description }, token)
        setPending(false)
        if (res.ok) {
          setDone(true)
          onSent()
        }
        else {
          setError(res.error)
          setToken(null)
          setTsKey((k) => k + 1)
        }
      }}
    >
      <div>
        <label htmlFor="change-type" className="block text-sm font-medium text-gray-700 mb-1">
          {CHANGE_REQUEST_COPY.step1}
        </label>
        <select id="change-type" className={INPUT} value={changeType} onChange={(e) => setChangeType(e.target.value as ChangeType)}>
          {CHANGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="change-description" className="block text-sm font-medium text-gray-700 mb-1">
          {CHANGE_REQUEST_COPY.step3}
        </label>
        <textarea
          id="change-description"
          rows={4}
          maxLength={2000}
          required
          className={INPUT}
          placeholder={CHANGE_REQUEST_COPY.step3Placeholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Turnstile onToken={setToken} resetKey={tsKey} />
      <Button type="submit" className="w-full sm:w-auto" disabled={pending || !description.trim()}>
        {pending ? '…' : CHANGE_REQUEST_COPY.send}
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}

/**
 * Private preview page (Lina, screen 1): banner card with the buttons, one inline panel at a time,
 * then the lazily loaded full-page screenshot. On phone, a sticky "Claim my website" bar appears
 * once the banner has scrolled away.
 */
export function PreviewView({ businessName, declinedMessage, prefill, services, screenshots, photosUsed }: PreviewViewProps) {
  const [panel, setPanel] = useState<Panel>(null)
  // Panels stay mounted (hidden) once opened, so the sent state and photo uploads survive toggling.
  const [opened, setOpened] = useState<{ details: boolean; change: boolean }>({ details: false, change: false })
  const [sent, setSent] = useState<{ details: boolean; change: boolean }>({ details: false, change: false })
  const [declined, setDeclined] = useState<string | null>(declinedMessage)
  const [declineError, setDeclineError] = useState<string | null>(null)
  const [bannerVisible, setBannerVisible] = useState(true)
  const banner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = banner.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setBannerVisible(entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const toggle = (p: Exclude<Panel, null>) => {
    setOpened((o) => ({ ...o, [p]: true }))
    setPanel((cur) => (cur === p ? null : p))
  }
  const claimOutline = claimIsOutline(panel, sent)

  async function decline() {
    setDeclineError(null)
    const res = await declinePreviewAction()
    if (res.ok) {
      setDeclined(res.message)
      setPanel(null)
    } else setDeclineError(res.error)
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24 md:pb-12">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div ref={banner} className={CARD} data-testid="preview-banner">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{fill(PREVIEW_BANNER_HEADING, { 'Business Name': businessName })}</h1>
          <p className="mt-2 text-gray-600" data-testid="banner-body">
            {declined ?? PREVIEW_BANNER_BODY}
          </p>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <Link
              href="/claim"
              className={cn(buttonVariants({ variant: claimOutline ? 'secondary' : 'primary', size: 'md' }), 'w-full min-h-[48px] md:w-auto')}
              data-emphasis={claimOutline ? 'outline' : 'red'}
              data-testid="claim-button"
            >
              {CLAIM_LABEL}
            </Link>
            <Button
              variant="secondary"
              className="w-full min-h-[48px] md:w-auto"
              aria-expanded={panel === 'details'}
              onClick={() => toggle('details')}
            >
              {ADD_DETAILS_LABEL}
            </Button>
            <Button
              variant="secondary"
              className="hidden md:inline-flex"
              aria-expanded={panel === 'change'}
              onClick={() => toggle('change')}
            >
              {REQUEST_CHANGE_LABEL}
            </Button>
            <span className="hidden text-sm text-gray-700 md:inline" data-testid="desktop-contact">
              {DESKTOP_CONTACT_TEXT}
            </span>
            <a href={SUPPORT_MAILTO} className={cn(TEXT_LINK, 'hidden md:inline')} aria-label={EMAIL_ARIA}>
              {EMAIL_US_LABEL}
            </a>
            {declined === null ? (
              <button type="button" onClick={decline} className={cn(GREY_LINK, 'hidden md:inline md:ml-auto')}>
                {NOT_NOW_LABEL}
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-gray-500">{PREVIEW_UNDER_MAIN_BUTTON}</p>

          {/* Phone: two rows of text links (Lina, 11:58 PM) */}
          <div className="mt-4 space-y-2 md:hidden" data-testid="phone-links">
            <div className="flex items-center justify-center gap-2">
              <button type="button" className={cn(TEXT_LINK, 'min-h-[44px] px-2')} aria-expanded={panel === 'change'} onClick={() => toggle('change')}>
                {REQUEST_CHANGE_LABEL}
              </button>
              {declined === null ? (
                <>
                  <span aria-hidden="true" className="text-gray-400">
                    ·
                  </span>
                  <button type="button" onClick={decline} className={cn(GREY_LINK, 'min-h-[44px] px-2')}>
                    {NOT_NOW_LABEL}
                  </button>
                </>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <a href={SUPPORT_TEL_HREF} aria-label={CALL_ARIA} className={PHONE_CONTACT}>
                {CALL_US_LABEL}
              </a>
              <a href={SUPPORT_SMS_HREF} aria-label={TEXT_ARIA} className={PHONE_CONTACT}>
                {TEXT_US_LABEL}
              </a>
              <a href={SUPPORT_MAILTO} aria-label={EMAIL_ARIA} className={PHONE_CONTACT}>
                {EMAIL_US_LABEL}
              </a>
            </div>
          </div>
          {declineError ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {declineError}
            </p>
          ) : null}
        </div>

        {opened.details ? (
          <section
            className={cn(CARD, panel === 'details' ? '' : 'hidden')}
            aria-label={DETAILS_HEADING}
            data-testid="details-panel"
          >
            <h2 className="text-lg font-semibold text-gray-900">{DETAILS_HEADING}</h2>
            {sent.details ? (
              // After sending, the thank-you line replaces the intro, with a green check (Lina / Sable 12:38 AM).
              <p className="mt-1 mb-5 flex items-start gap-2 text-sm font-medium text-gray-800" role="status" data-testid="details-thanks">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" data-testid="details-thanks-check" />
                <span>{DETAILS_SUCCESS}</span>
              </p>
            ) : (
              <p className="mt-1 mb-5 text-sm text-gray-600" data-testid="details-intro">
                {DETAILS_INTRO}
              </p>
            )}
            <DetailsForm
              mode="preview"
              prefill={prefill}
              services={services}
              submitLabel={SEND_DETAILS_LABEL}
              // The panel header shows the thank-you line; the sent photos stay below it.
              successText=""
              lockUntilComplete={false}
              withTurnstile
              photosAlreadySent={photosUsed}
              onSent={() => setSent((x) => ({ ...x, details: true }))}
              onSubmit={async (payload, token) => {
                const res = await sendPreviewDetailsAction(payload, token)
                return res.ok ? { ok: true, submissionId: res.submissionId } : { ok: false, error: res.error }
              }}
              uploadPhoto={async (_submissionId, clientPhotoId, blob) => {
                const fd = new FormData()
                fd.set('id', clientPhotoId)
                fd.set('file', blob, 'photo.jpg')
                const res = await uploadPreviewPhotoAction(fd)
                return res.ok ? { ok: true, photoId: res.photoId } : { ok: false, code: res.code, error: res.error }
              }}
            />
          </section>
        ) : null}
        {opened.change ? (
          <section className={cn(CARD, panel === 'change' ? '' : 'hidden')} aria-label={REQUEST_CHANGE_LABEL} data-testid="change-panel">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{REQUEST_CHANGE_LABEL}</h2>
            <ChangeRequestPanel onSent={() => setSent((x) => ({ ...x, change: true }))} />
          </section>
        ) : null}

        <section data-testid="screenshot-section">
          <div className="mb-2 flex flex-col items-end gap-1 text-right">
            <Link href="/preview/full" className={TEXT_LINK} target="_blank" rel="noreferrer">
              {OPEN_FULL_SCREEN_LABEL}
            </Link>
            <p className="text-xs text-gray-500">{SCREENSHOT_NOTE}</p>
          </div>
          <ScreenshotPicture desktop={screenshots.desktop} mobile={screenshots.mobile} alt={businessName} />
        </section>
      </div>

      {!bannerVisible ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:hidden" data-testid="sticky-claim">
          <Link href="/claim" className={cn(buttonVariants({ variant: claimOutline ? 'secondary' : 'primary', size: 'md' }), 'flex h-12 w-full')}>
            {CLAIM_LABEL}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
