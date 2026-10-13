'use server'

import {
  declinePreview,
  submitPreviewChangeRequest,
  submitPreviewDetails,
  uploadPreviewPhoto,
} from '@/lib/outreach/server'
import { customerMessage } from '@/lib/outreach/errors'
import { NOT_NOW_CONFIRM, fill, formatExpiryDate } from '@/lib/outreach/copy'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; code?: string; error: string }

/** "Send my details": details first (Turnstile + limits), then photos one by one. */
export async function sendPreviewDetailsAction(input: unknown, turnstileToken: string | null): Promise<ActionResult<{ submissionId: string }>> {
  const res = await submitPreviewDetails(input, turnstileToken)
  return res.ok ? res : { ok: false, code: res.code, error: customerMessage(res.code) }
}

/** One photo per request (FormData: id = client UUID, file = resized JPEG). */
export async function uploadPreviewPhotoAction(formData: FormData): Promise<ActionResult<{ photoId: string }>> {
  const res = await uploadPreviewPhoto(formData.get('id'), formData.get('file'))
  return res.ok ? res : { ok: false, code: res.code, error: customerMessage(res.code) }
}

export async function sendPreviewChangeAction(input: unknown, turnstileToken: string | null): Promise<ActionResult> {
  const res = await submitPreviewChangeRequest(input, turnstileToken)
  return res.ok ? { ok: true } : { ok: false, code: res.code, error: customerMessage(res.code) }
}

export async function declinePreviewAction(): Promise<ActionResult<{ message: string }>> {
  const res = await declinePreview()
  if (!res.ok) return { ok: false, code: res.code, error: customerMessage(res.code) }
  return { ok: true, message: fill(NOT_NOW_CONFIRM, { 'expiry date': formatExpiryDate(new Date(res.expiresAt)) }) }
}
