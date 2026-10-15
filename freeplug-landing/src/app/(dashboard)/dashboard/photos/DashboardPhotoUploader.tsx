'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoUploadBox, usePhotoQueue } from '@/components/outreach/PhotoUploadBox'
import { FIELD_PHOTOS, UPLOAD_PHOTOS_LABEL } from '@/lib/outreach/copy'
import { uploadCustomerPhotoAction } from '@/app/claim/actions'
import { startPhotoBatchAction } from './actions'

/** Dashboard "Upload photos": pick photos, then send them (three at a time, each retryable). */
export function DashboardPhotoUploader({ photosUsed }: { photosUsed: number }) {
  const queue = usePhotoQueue(photosUsed)
  const [submissionId, setSubmissionId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const uploaderFor = (sid: string | null) => async (clientPhotoId: string, blob: Blob) => {
    const fd = new FormData()
    fd.set('submissionId', sid ?? '')
    fd.set('id', clientPhotoId)
    fd.set('file', blob, 'photo.jpg')
    const res = await uploadCustomerPhotoAction(fd)
    return res.ok ? { ok: true as const, photoId: res.photoId } : { ok: false as const, code: res.code, error: res.error }
  }

  const ready = queue.photos.filter((p) => p.status === 'ready').length

  return (
    <div className="space-y-4">
      <PhotoUploadBox
        label={FIELD_PHOTOS}
        queue={queue}
        disabled={pending}
        onRetry={submissionId === undefined ? undefined : (id) => queue.retry(id, uploaderFor(submissionId))}
      />
      <Button
        disabled={pending || ready === 0}
        className="w-full sm:w-auto"
        onClick={async () => {
          setPending(true)
          setError(null)
          let sid = submissionId
          if (sid === undefined) {
            // The first valid photo opens the batch (no empty submission if every photo is refused).
            for (const photo of queue.photos.filter((p) => p.status === 'ready')) {
              let opened: string | null | undefined
              await queue.uploadOne(photo, async (clientPhotoId, blob) => {
                const fd = new FormData()
                fd.set('id', clientPhotoId)
                fd.set('file', blob, 'photo.jpg')
                const res = await startPhotoBatchAction(fd)
                if (res.ok) opened = res.submissionId
                return res.ok ? { ok: true as const, photoId: res.photoId } : { ok: false as const, code: res.code, error: res.error }
              })
              if (opened !== undefined) {
                sid = opened
                setSubmissionId(opened)
                break
              }
            }
            if (sid === undefined) {
              setPending(false)
              return
            }
          }
          await queue.uploadAll(uploaderFor(sid))
          setPending(false)
        }}
      >
        {pending ? '…' : UPLOAD_PHOTOS_LABEL}
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
