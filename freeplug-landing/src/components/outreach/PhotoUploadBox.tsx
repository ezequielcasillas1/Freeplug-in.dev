'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { fill } from '@/lib/outreach/copy'
import { localizeRefusal, usePhotoCopy, type PhotoCopy } from '@/lib/outreach/use-photo-copy'
import { PHOTO_ACCEPT, preparePhoto } from '@/lib/outreach/client-image'
import { PHOTO_LIMITS } from '@/lib/outreach/limits'
import {
  COLLAPSED_DESKTOP,
  COLLAPSED_PHONE,
  newClientPhotoId,
  orderForGrid,
  preparePicked,
  remainingSlots,
  uploadWithRetry,
  type UploadResult,
} from '@/lib/outreach/photo-queue'
import { runWithConcurrency } from '@/lib/outreach/upload-queue'

export type PhotoStatus = 'ready' | 'uploading' | 'retrying' | 'done' | 'failed'
/** `id` is the photo's idempotency key (client UUID), sent with every try. */
export type QueuePhoto = { id: string; blob: Blob; url: string; status: PhotoStatus; error?: string }
export type RefusedPhoto = { id: string; name: string; message: string }
export type PhotoUploader = (clientPhotoId: string, blob: Blob) => Promise<UploadResult>

function failureMessage(C: PhotoCopy, code: string | undefined): string {
  if (code === 'photo_limit') return C.PHOTO_LIMIT_REACHED
  if (code === 'rate') return C.ERROR_TOO_MANY_TRIES
  if (code === 'bad_type' || code === 'unreadable' || code === 'too_large') return C.PHOTO_REFUSED
  return C.PHOTO_FAILED_TEXT
}

/** Photo list state + uploads (three at a time, automatic retries, tap-to-retry). */
export function usePhotoQueue(alreadySent: number) {
  const C = usePhotoCopy()
  const [photos, setPhotos] = useState<QueuePhoto[]>([])
  const [refused, setRefused] = useState<RefusedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [limitHit, setLimitHit] = useState(false)
  const latest = useRef(photos)
  useEffect(() => {
    latest.current = photos
  }, [photos])
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const patch = useCallback((id: string, next: Partial<QueuePhoto>) => {
    setPhotos((all) => all.map((p) => (p.id === id ? { ...p, ...next } : p)))
  }, [])

  const add = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return
      setError(null)
      setBusy(true)
      let waiting = latest.current.length
      try {
        for (const file of Array.from(files)) {
          if (remainingSlots(alreadySent, waiting) <= 0) {
            setError(C.ERROR_TOO_MANY_PHOTOS)
            break
          }
          const out = await preparePicked(file, preparePhoto)
          if (out.kind === 'refused') {
            // No thumbnail, no server call, no count toward the 50.
            setRefused((r) => [...r, { id: newClientPhotoId(), name: file.name, message: localizeRefusal(C, out.message) }])
            continue
          }
          waiting += 1
          const photo: QueuePhoto = { id: newClientPhotoId(), blob: out.blob, url: URL.createObjectURL(out.blob), status: 'ready' }
          setPhotos((all) => [...all, photo])
        }
      } finally {
        setBusy(false)
      }
    },
    [alreadySent, C]
  )

  const remove = useCallback((id: string) => {
    const p = latest.current.find((x) => x.id === id)
    if (p) URL.revokeObjectURL(p.url)
    setPhotos((all) => all.filter((x) => x.id !== id))
    setError(null)
  }, [])

  const dismissRefused = useCallback((id: string) => setRefused((r) => r.filter((x) => x.id !== id)), [])

  const uploadOne = useCallback(
    async (photo: QueuePhoto, uploader: PhotoUploader) => {
      // Never send a body the server would refuse for size (it is shrunk before this; Vera QA #4).
      if (photo.blob.size > PHOTO_LIMITS.maxUploadBytes) {
        patch(photo.id, { status: 'failed', error: failureMessage(C, 'too_large') })
        return
      }
      patch(photo.id, { status: 'uploading', error: undefined })
      const res = await uploadWithRetry(() => uploader(photo.id, photo.blob), {
        onRetrying: () => patch(photo.id, { status: 'retrying' }),
      })
      if (res.ok) patch(photo.id, { status: 'done', error: undefined })
      else {
        if (res.code === 'photo_limit') setLimitHit(true)
        patch(photo.id, { status: 'failed', error: failureMessage(C, res.code) })
      }
    },
    [patch, C]
  )

  const uploadAll = useCallback(
    async (uploader: PhotoUploader) => {
      const queue = latest.current.filter((p) => p.status === 'ready')
      await runWithConcurrency(queue, (p) => uploadOne(p, uploader), PHOTO_LIMITS.uploadConcurrency)
    },
    [uploadOne]
  )

  const retry = useCallback(
    (id: string, uploader: PhotoUploader) => {
      const p = latest.current.find((x) => x.id === id)
      if (p && p.status === 'failed') void uploadOne(p, uploader)
    },
    [uploadOne]
  )

  return { photos, refused, error, busy, limitHit, add, remove, dismissRefused, uploadAll, uploadOne, retry, alreadySent }
}

export type PhotoQueue = ReturnType<typeof usePhotoQueue>

/** A photo that already reached Freeplug earlier (e.g. sent from the preview): shown as done, not removable. */
export type SentPhoto = { id: string; url: string }

type GridItem = (QueuePhoto & { carried?: false }) | { id: string; url: string; status: 'done'; carried: true; error?: undefined }

type Props = {
  label: string
  queue: PhotoQueue
  /**
   * Photos sent earlier (claim step 2 carries over the ones sent from the preview). They count
   * toward the total through the queue's `alreadySent`, which the caller sets to include them.
   */
  sentPhotos?: readonly SentPhoto[]
  /** After the form was sent: no adding; failed photos can be retried or removed. */
  sent?: boolean
  disabled?: boolean
  onRetry?: (id: string) => void
}

/**
 * Lina's photo box: the "{n} of 50 photos" count and upload box above the grid; the grid shows two
 * rows (6 on phone, 10 on desktop) until "Show all {n} photos". Each thumbnail shows its own status.
 */
export function PhotoUploadBox({ label, queue, sentPhotos = [], sent = false, disabled, onRetry }: Props) {
  const C = usePhotoCopy()
  const [expanded, setExpanded] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { photos, refused, error, busy, limitHit, add, remove, dismissRefused, alreadySent } = queue
  const total = alreadySent + photos.length
  const atLimit = limitHit || remainingSlots(alreadySent, photos.length) <= 0
  // Failed first (never hidden behind "Show all"), then the carried-over photos, then new ones.
  const newOrdered = orderForGrid(photos)
  const firstOk = newOrdered.findIndex((p) => p.status !== 'failed')
  const splitAt = firstOk === -1 ? newOrdered.length : firstOk
  const ordered: GridItem[] = [
    ...newOrdered.slice(0, splitAt),
    ...sentPhotos.map((p) => ({ id: p.id, url: p.url, status: 'done' as const, carried: true as const })),
    ...newOrdered.slice(splitAt),
  ]
  const retrying = photos.some((p) => p.status === 'retrying')

  return (
    <div data-testid="photo-box">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <label htmlFor="outreach-photos" className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <span className="text-xs text-gray-500" data-testid="photo-count">
          {fill(C.PHOTO_COUNT_TEXT, { n: String(total) })}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{C.FIELD_PHOTOS_HELP}</p>
      {atLimit ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-100 px-4 py-5 text-sm text-gray-600" data-testid="photo-limit">
          {C.PHOTO_LIMIT_REACHED}
        </div>
      ) : !sent ? (
        <label
          className={`flex min-h-[88px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-gray-600 hover:border-zinc-400 ${
            disabled || busy ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <input
            ref={input}
            id="outreach-photos"
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="sr-only"
            disabled={disabled || busy}
            onChange={async (e) => {
              const files = e.target.files ? Array.from(e.target.files) : []
              e.target.value = ''
              await add(files)
            }}
          />
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span aria-hidden="true">+</span>}
          <span className="ml-2">{C.ADD_PHOTOS_LABEL}</span>
        </label>
      ) : null}
      {refused.length > 0 ? (
        <ul className="mt-2 space-y-1" data-testid="photo-refused">
          {/* Sable 1:18 AM: named after the file, since the refused file isn't in the grid (Vera r2 bug 7). */}
          {refused.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm text-red-700">
              <span className="flex-1 break-words">
                <span className="font-medium">{r.name}</span>: {r.message}
              </span>
              <button
                type="button"
                onClick={() => dismissRefused(r.id)}
                aria-label={fill(C.REFUSED_DISMISS_ARIA, { 'file name': r.name })}
                className="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-zinc-100"
                data-testid="photo-refused-dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {retrying ? (
        <p className="mt-2 text-xs text-gray-500" role="status">
          {C.PHOTO_RETRYING_TEXT}
        </p>
      ) : null}
      {ordered.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5" data-testid="photo-grid">
          {ordered.map((p, i) => {
            const hide = expanded ? '' : i >= COLLAPSED_DESKTOP ? 'hidden' : i >= COLLAPSED_PHONE ? 'hidden md:block' : ''
            const failed = p.status === 'failed'
            const n = { n: String(i + 1) }
            return (
              <li
                key={p.id}
                data-status={p.status}
                data-carried={p.carried ? 'true' : undefined}
                className={`relative aspect-square overflow-hidden rounded-lg border bg-white ${
                  failed ? 'border-red-500 ring-2 ring-red-500' : 'border-zinc-200'
                } ${hide}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL or short-lived signed URL */}
                <img src={p.url} alt="" className={`h-full w-full object-cover ${p.status === 'uploading' || p.status === 'retrying' || failed ? 'opacity-60' : ''}`} />
                {p.status === 'uploading' ? (
                  <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-label={fill(C.PHOTO_UPLOADING_ARIA, n)}>
                    <span className="block h-full w-1/2 animate-pulse rounded-full bg-zinc-500" />
                  </span>
                ) : null}
                {p.status === 'retrying' ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-medium text-gray-800">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    {C.THUMB_TRYING_AGAIN}
                  </span>
                ) : null}
                {p.status === 'done' ? (
                  <span
                    className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow"
                    aria-label={fill(C.PHOTO_UPLOADED_ARIA, n)}
                    role="img"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </span>
                ) : null}
                {failed && onRetry && p.error === C.PHOTO_FAILED_TEXT ? (
                  <button
                    type="button"
                    onClick={() => onRetry(p.id)}
                    className="absolute inset-0 flex items-end justify-center p-1 text-xs font-semibold text-[#ba3d3d]"
                    aria-label={C.PHOTO_FAILED_TEXT}
                  >
                    <span className="w-full rounded-md bg-white/95 px-1 py-2 shadow">{C.THUMB_TAP_TO_RETRY}</span>
                  </button>
                ) : null}
                {!p.carried && (p.status === 'ready' || failed) ? (
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={disabled}
                    aria-label={fill(C.PHOTO_REMOVE_ARIA, n)}
                    // 44x44 tap area in the thumbnail's top-right corner; the visible circle stays small (Vera QA #6).
                    className="group absolute right-0 top-0 z-10 flex h-11 w-11 items-start justify-end p-1"
                    data-testid="photo-remove"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow group-hover:bg-white">
                      <X className="h-4 w-4" />
                    </span>
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {ordered.length > COLLAPSED_PHONE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-[#ba3d3d] hover:underline ${
            !expanded && ordered.length <= COLLAPSED_DESKTOP ? 'md:hidden' : ''
          }`}
        >
          {expanded ? C.SHOW_FEWER_PHOTOS : fill(C.SHOW_ALL_PHOTOS, { n: String(ordered.length) })}
        </button>
      ) : null}
      {photos.some((p) => p.status === 'failed' && p.error && p.error !== C.PHOTO_FAILED_TEXT) ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {photos.find((p) => p.status === 'failed' && p.error !== C.PHOTO_FAILED_TEXT)?.error}
        </p>
      ) : null}
    </div>
  )
}
