'use server'

import { revalidatePath } from 'next/cache'
import {
  adminApplySubmission,
  adminCleanupUnclaimedPreviewPhotos,
  adminCreateOutreachSite,
  adminDeleteAppliedPhotoFiles,
  adminExtendLink,
  adminMarkDomainRequestDone,
  adminPublishSite,
  adminRejectSubmission,
  adminReviewChangeRequest,
  adminRevokeLink,
  adminSubmissionPhotoUrls,
  adminUnclaimAndReissue,
  adminUploadScreenshot,
} from '@/lib/outreach/server'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function done<T extends { ok: boolean }>(res: T): T {
  revalidatePath('/admin/outreach')
  return res
}

export async function createOutreachSiteAction(input: unknown): Promise<R<{ siteId: string; link: string }>> {
  return done(await adminCreateOutreachSite(input))
}

/** One screenshot per request (FormData: siteId, kind = desktop | mobile, file). */
export async function uploadScreenshotAction(formData: FormData): Promise<R> {
  const kind = formData.get('kind') === 'mobile' ? 'mobile' : 'desktop'
  return done(await adminUploadScreenshot(String(formData.get('siteId') ?? ''), kind, formData.get('file')))
}

export async function extendLinkAction(siteId: string): Promise<R> {
  return done(await adminExtendLink(siteId))
}

export async function revokeLinkAction(siteId: string): Promise<R> {
  return done(await adminRevokeLink(siteId))
}

export async function unclaimAndReissueAction(siteId: string): Promise<R<{ link: string }>> {
  return done(await adminUnclaimAndReissue(siteId))
}

export async function applySubmissionAction(id: string): Promise<R> {
  return done(await adminApplySubmission(id))
}

export async function rejectSubmissionAction(id: string): Promise<R> {
  return done(await adminRejectSubmission(id))
}

export async function reviewChangeRequestAction(id: string, status: 'applied' | 'rejected'): Promise<R> {
  return done(await adminReviewChangeRequest(id, status))
}

export async function publishSiteAction(siteId: string, claimerVerified: boolean, liveUrl: string): Promise<R> {
  const res = await adminPublishSite(siteId, { claimerVerified, liveUrl })
  revalidatePath('/admin/outreach')
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

export async function submissionPhotosAction(id: string): Promise<string[]> {
  return adminSubmissionPhotoUrls(id)
}

export async function markDomainDoneAction(id: string): Promise<R> {
  return done(await adminMarkDomainRequestDone(id))
}

export async function cleanupPhotosAction(): Promise<R<{ deleted: number }>> {
  try {
    const res = await adminCleanupUnclaimedPreviewPhotos()
    revalidatePath('/admin/outreach')
    return { ok: true, deleted: res.deleted }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Cleanup failed.' }
  }
}

/** Deletes Freeplug's stored copies of a site's approved photos (after they were added to the site). */
export async function deleteApprovedPhotoFilesAction(siteId: string): Promise<R<{ deleted: number }>> {
  return done(await adminDeleteAppliedPhotoFiles(siteId))
}
