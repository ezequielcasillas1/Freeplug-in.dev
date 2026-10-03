'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Turnstile } from '@/components/turnstile/Turnstile'
import {
  ADD_LABEL,
  ADD_SERVICE_LABEL,
  BLANK_FIELD_HINT,
  CHECK_ADDRESS,
  CHECK_HOURS,
  CHECK_PHONE,
  CHECK_PHOTOS,
  CHECK_QUOTE_EMAIL,
  CHECK_SERVICE_AREA,
  COUNTER_TEXT,
  EDIT_LABEL,
  FIELD_ADDRESS,
  FIELD_ADDRESS_HELP,
  FIELD_HOURS,
  FIELD_PHONE,
  FIELD_PHOTOS,
  FIELD_QUOTE_EMAIL,
  FIELD_QUOTE_EMAIL_HELP,
  FIELD_SERVICE_AREA,
  FIELD_SERVICE_AREA_HELP,
  KEEP_LABEL,
  LOOKS_RIGHT_LABEL,
  PHONE_INVALID,
  REMOVE_LABEL,
  SERVICES_HEADING,
  SERVICES_INTRO,
  SOURCE_LINE,
  UNDO_LABEL,
  fill,
} from '@/lib/outreach/copy'
import {
  canConfirm,
  checkedCounts,
  initialFieldStates,
  initialServiceStates,
  isFieldAnswered,
  phoneInvalid,
  removeService,
  toSubmission,
  undoRemoveService,
  type FieldState,
  type ServiceState,
} from '@/lib/outreach/details-state'
import { normalizePhone } from '@/lib/outreach/phone'
import { serviceSourceLine, type DetailKey, type PrefillMap, type ServiceItem } from '@/lib/outreach/schemas'
import type { UploadResult } from '@/lib/outreach/photo-queue'
import { PhotoUploadBox, usePhotoQueue, type SentPhoto } from './PhotoUploadBox'

export type DetailsPayload = ReturnType<typeof toSubmission>
/** submissionId: the pending submission the photos attach to (null = the user's own photos). */
export type DetailsSubmitResult = { ok: true; submissionId: string | null } | { ok: false; error: string }
export type DetailsPhotoUploader = (submissionId: string | null, clientPhotoId: string, blob: Blob) => Promise<UploadResult>

type Props = {
  mode: 'preview' | 'claim'
  prefill: PrefillMap
  services: ServiceItem[]
  initialFields?: Partial<Record<DetailKey, string>>
  initialServices?: { name: string; keep: boolean }[]
  submitLabel: string
  successText: string
  /** Claim step 2 stays disabled until everything has an answer; the preview never locks (Jace). */
  lockUntilComplete: boolean
  /** Preview only: Cloudflare Turnstile. */
  withTurnstile?: boolean
  onSubmit: (payload: DetailsPayload, turnstileToken: string | null) => Promise<DetailsSubmitResult>
  /** One photo, after the details were sent (three at a time, each retryable). */
  uploadPhoto: DetailsPhotoUploader
  /** Photos already sent from this link / by this customer that aren't shown here (toward the 50). */
  photosAlreadySent?: number
  /**
   * Claim step 2: the photos sent from the preview, carried over. Shown as done thumbnails and
   * counted toward the total (Lina, Sep 27).
   */
  sentPhotos?: readonly SentPhoto[]
  /** Called once when the details were sent (the preview banner uses it for button emphasis). */
  onSent?: () => void
  /**
   * Claim step 2: called once the details are sent and every photo is uploaded (or removed), so
   * the page can move to the next step without cutting uploads off.
   */
  onDone?: () => void
}

const INPUT =
  // min-h-[44px]: phone tap targets (Vera QA #6).
  'w-full min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none'
const OUTLINE = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-gray-800 hover:bg-zinc-50'

const LABELS: Record<'preview' | 'claim', Record<DetailKey, string>> = {
  preview: {
    phone: FIELD_PHONE,
    address: FIELD_ADDRESS,
    hours: FIELD_HOURS,
    service_area: FIELD_SERVICE_AREA,
    quote_email: FIELD_QUOTE_EMAIL,
  },
  claim: {
    phone: CHECK_PHONE,
    address: CHECK_ADDRESS,
    hours: CHECK_HOURS,
    service_area: CHECK_SERVICE_AREA,
    quote_email: CHECK_QUOTE_EMAIL,
  },
}
const HELP: Partial<Record<DetailKey, string>> = {
  address: FIELD_ADDRESS_HELP,
  service_area: FIELD_SERVICE_AREA_HELP,
  quote_email: FIELD_QUOTE_EMAIL_HELP,
}
const MULTILINE: DetailKey[] = ['hours', 'service_area']

function FieldRow({
  f,
  label,
  answered,
  error = null,
  onChange,
  onBlur,
}: {
  f: FieldState
  label: string
  answered: boolean
  error?: string | null
  onChange: (next: FieldState) => void
  onBlur?: () => void
}) {
  const id = `detail-${f.key}`
  const help = HELP[f.key]
  const box = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  // Edit focuses the box and selects its value, so typing replaces it (Vera r2 bug 3).
  const selectOnOpen = useRef(false)
  useEffect(() => {
    if (selectOnOpen.current && f.mode === 'editing' && box.current) {
      selectOnOpen.current = false
      box.current.focus()
      box.current.select()
    }
  }, [f.mode])
  const inputProps = {
    id,
    ref: box,
    name: f.key,
    value: f.value,
    maxLength: f.key === 'phone' ? 50 : f.key === 'quote_email' ? 320 : 500,
    className: INPUT,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...f, value: e.target.value }),
    onBlur,
  }
  return (
    <div data-testid={`field-${f.key}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {/* Never a green check next to an error (Lina gap 2, round 5). */}
        {answered && !error ? <Check className="h-4 w-4 text-green-600" aria-label="Checked" data-testid={`check-${f.key}`} /> : null}
      </div>
      {help ? <p className="text-xs text-gray-500 mb-2">{help}</p> : null}
      {f.mode === 'prefilled' || f.mode === 'confirmed' ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-gray-900 whitespace-pre-wrap break-words" data-testid={`value-${f.key}`}>
            {f.value}
          </p>
          {f.source ? (
            <p className="text-xs text-gray-500 mt-1" data-testid={`source-${f.key}`}>
              {fill(SOURCE_LINE, { source: f.source })}
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4">
            <button
              type="button"
              className={`${OUTLINE} ${f.mode === 'confirmed' ? 'bg-zinc-200 hover:bg-zinc-200' : 'bg-white'}`}
              aria-pressed={f.mode === 'confirmed'}
              onClick={() => onChange({ ...f, mode: 'confirmed' })}
            >
              {LOOKS_RIGHT_LABEL}
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-[#ba3d3d] hover:underline"
              onClick={() => {
                selectOnOpen.current = true
                onChange({ ...f, mode: 'editing' })
              }}
            >
              {EDIT_LABEL}
            </button>
          </div>
        </div>
      ) : (
        <>
          {f.mode === 'blank' ? <p className="text-xs text-gray-500 mb-2">{BLANK_FIELD_HINT}</p> : null}
          {MULTILINE.includes(f.key) ? (
            <textarea rows={2} {...inputProps} />
          ) : (
            <input
              type={f.key === 'quote_email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
              inputMode={f.key === 'phone' ? 'tel' : undefined}
              autoComplete={f.key === 'phone' ? 'tel' : undefined}
              {...inputProps}
            />
          )}
          {error ? (
            <p id={`${id}-error`} className="mt-1 text-sm text-red-700" role="alert" data-testid={`error-${f.key}`}>
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

function ServicesChecklist({
  services,
  sources,
  onChange,
}: {
  services: ServiceState[]
  sources: Map<string, string>
  onChange: (s: ServiceState[]) => void
}) {
  const [draft, setDraft] = useState('')
  const update = (i: number, fn: (s: ServiceState) => ServiceState) => onChange(services.map((s, j) => (j === i ? fn(s) : s)))
  const set = (i: number, choice: 'keep') => update(i, (s) => ({ name: s.name, added: s.added, choice }))
  function add() {
    const name = draft.trim().slice(0, 100)
    if (!name) return
    if (services.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...services, { name, choice: 'keep', added: true }])
    setDraft('')
  }
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4" data-testid="services">
      <h3 className="text-sm font-medium text-gray-900">{SERVICES_HEADING}</h3>
      <p className="text-xs text-gray-500 mt-1 mb-3">{SERVICES_INTRO}</p>
      <ul className="divide-y divide-zinc-100">
        {services.map((s, i) => (
          <li key={s.name} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between" data-testid={`service-${s.name}`}>
            <span className="min-w-0">
              <span className={`block text-sm ${s.choice === 'remove' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{s.name}</span>
              {sources.get(s.name) ? (
                <span className="block text-xs text-gray-500" data-testid={`service-source-${s.name}`}>
                  {sources.get(s.name)}
                </span>
              ) : null}
            </span>
            {s.choice === 'remove' ? (
              <button type="button" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#ba3d3d] hover:underline" onClick={() => update(i, undoRemoveService)}>
                {UNDO_LABEL}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  aria-pressed={s.choice === 'keep'}
                  className={`${OUTLINE} ${s.choice === 'keep' ? 'bg-zinc-200 hover:bg-zinc-200' : 'bg-white'}`}
                  onClick={() => set(i, 'keep')}
                >
                  {KEEP_LABEL}
                </button>
                <button type="button" aria-pressed={false} className={`${OUTLINE} bg-white`} onClick={() => update(i, removeService)}>
                  {REMOVE_LABEL}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <label htmlFor="add-service" className="block text-sm font-medium text-gray-700 mb-1">
          {ADD_SERVICE_LABEL}
        </label>
        <div className="flex gap-2">
          <input
            id="add-service"
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            className={INPUT}
          />
          <button type="button" className={`${OUTLINE} bg-white`} onClick={add}>
            {ADD_LABEL}
          </button>
        </div>
      </div>
    </section>
  )
}

/**
 * One details form for the preview panel ("Add your details") and claim step 2 ("Confirm your
 * details"). Nothing changes on the site from here: the submission goes to admin review.
 */
export function DetailsForm({
  mode,
  prefill,
  services: serviceItems,
  initialFields,
  initialServices,
  submitLabel,
  successText,
  lockUntilComplete,
  withTurnstile = false,
  onSubmit,
  uploadPhoto,
  photosAlreadySent = 0,
  sentPhotos = [],
  onSent,
  onDone,
}: Props) {
  const serviceNames = serviceItems.map((s) => s.name)
  const sources = new Map(serviceItems.map((s) => [s.name, serviceSourceLine(s.source)]))
  const [fields, setFields] = useState(() => initialFieldStates(prefill, initialFields))
  const [services, setServices] = useState(() => initialServiceStates(serviceNames, initialServices))
  const photoQueue = usePhotoQueue(photosAlreadySent + sentPhotos.length)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [tsKey, setTsKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const uploader = (clientPhotoId: string, blob: Blob) => uploadPhoto(submissionId, clientPhotoId, blob)
  const settled = done && photoQueue.photos.every((p) => p.status === 'done')
  useEffect(() => {
    if (settled && onDone) onDone()
  }, [settled, onDone])

  if (done) {
    // Thank-you line replaces the form (buyout-card pattern); photos keep uploading underneath,
    // and a failed photo retries on its own without sending the form again.
    return (
      <div className="space-y-4">
        {successText ? (
          <p className="text-sm font-medium text-gray-800" role="status" data-testid="details-thanks">
            {successText}
          </p>
        ) : null}
        {photoQueue.photos.length > 0 || sentPhotos.length > 0 ? (
          <PhotoUploadBox
            label={mode === 'claim' ? CHECK_PHOTOS : FIELD_PHOTOS}
            queue={photoQueue}
            sentPhotos={sentPhotos}
            sent
            onRetry={(id) => photoQueue.retry(id, uploader)}
          />
        ) : null}
      </div>
    )
  }

  const { n, total } = checkedCounts(fields, services, prefill)
  const complete = canConfirm(fields, services, prefill)
  const disabled = pending || (lockUntilComplete && !complete)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    // Phone check before sending (Sable 1:18 AM); the server checks again.
    if (phoneInvalid(fields)) {
      setPhoneError(PHONE_INVALID)
      document.getElementById('detail-phone')?.focus()
      return
    }
    setPending(true)
    setError(null)
    try {
      const res = await onSubmit(toSubmission(fields, services), token)
      if (res.ok) {
        const sid = res.submissionId
        setSubmissionId(sid)
        setDone(true)
        onSent?.()
        void photoQueue.uploadAll((clientPhotoId, blob) => uploadPhoto(sid, clientPhotoId, blob))
      } else {
        setError(res.error)
        setToken(null)
        setTsKey((k) => k + 1)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" data-testid={`details-form-${mode}`}>
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          f={f}
          label={LABELS[mode][f.key]}
          // The phone's check comes back only once the number is valid (Lina gap 2, round 5).
          answered={isFieldAnswered(f, prefill) && !(f.key === 'phone' && phoneInvalid([f]))}
          error={f.key === 'phone' ? phoneError : null}
          onChange={(next) => {
            if (next.key === 'phone') setPhoneError(null)
            setFields((all) => all.map((x) => (x.key === next.key ? next : x)))
          }}
          onBlur={
            f.key === 'phone'
              ? () => {
                  // Show the number as 512-555-0142 once it's valid; say what's wrong when it isn't.
                  const v = f.value.trim()
                  const n = normalizePhone(v)
                  if (n && n !== f.value) setFields((all) => all.map((x) => (x.key === 'phone' ? { ...x, value: n } : x)))
                  setPhoneError(v !== '' && !n ? PHONE_INVALID : null)
                }
              : undefined
          }
        />
      ))}
      {services.length > 0 || mode === 'claim' || serviceNames.length === 0 ? (
        <ServicesChecklist services={services} sources={sources} onChange={setServices} />
      ) : null}
      <PhotoUploadBox label={mode === 'claim' ? CHECK_PHOTOS : FIELD_PHOTOS} queue={photoQueue} sentPhotos={sentPhotos} disabled={pending} />
      {withTurnstile ? <Turnstile onToken={setToken} resetKey={tsKey} /> : null}
      <div>
        <p className="text-sm text-gray-500 mb-2" data-testid="checked-counter">
          {fill(COUNTER_TEXT, { n: String(n), total: String(total) })}
        </p>
        <Button type="submit" className="w-full sm:w-auto" disabled={disabled} aria-disabled={disabled}>
          {pending ? '…' : submitLabel}
        </Button>
        {error ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  )
}
