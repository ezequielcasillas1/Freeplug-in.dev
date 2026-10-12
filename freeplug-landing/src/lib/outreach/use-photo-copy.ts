'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import * as C from '@/lib/outreach/copy'
import { PHOTO_LIMITS } from '@/lib/outreach/limits'
import { SUPPORT_EMAIL } from '@/lib/site'

/**
 * Photo box copy in the active locale. English returns the copy.ts constants unchanged; other
 * locales read claim.* keys. `{n}` / `{file name}` stay as tokens so callers keep using `fill()`.
 */
export function usePhotoCopy() {
  const locale = useLocale()
  const t = useTranslations('claim')
  return useMemo(() => {
    const en = {
      ADD_PHOTOS_LABEL: C.ADD_PHOTOS_LABEL,
      ERROR_TOO_LARGE: C.ERROR_TOO_LARGE,
      ERROR_TOO_MANY_PHOTOS: C.ERROR_TOO_MANY_PHOTOS,
      ERROR_TOO_MANY_TRIES: C.ERROR_TOO_MANY_TRIES,
      FIELD_PHOTOS_HELP: C.FIELD_PHOTOS_HELP,
      PHOTO_COUNT_TEXT: C.PHOTO_COUNT_TEXT,
      PHOTO_FAILED_TEXT: C.PHOTO_FAILED_TEXT,
      PHOTO_LIMIT_REACHED: C.PHOTO_LIMIT_REACHED,
      PHOTO_REFUSED: C.PHOTO_REFUSED,
      PHOTO_REMOVE_ARIA: C.PHOTO_REMOVE_ARIA,
      REFUSED_DISMISS_ARIA: C.REFUSED_DISMISS_ARIA,
      PHOTO_RETRYING_TEXT: C.PHOTO_RETRYING_TEXT,
      PHOTO_UPLOADED_ARIA: C.PHOTO_UPLOADED_ARIA,
      PHOTO_UPLOADING_ARIA: C.PHOTO_UPLOADING_ARIA,
      SHOW_ALL_PHOTOS: C.SHOW_ALL_PHOTOS,
      SHOW_FEWER_PHOTOS: C.SHOW_FEWER_PHOTOS,
      THUMB_TAP_TO_RETRY: C.THUMB_TAP_TO_RETRY,
      THUMB_TRYING_AGAIN: C.THUMB_TRYING_AGAIN,
    }
    if (locale === 'en') return en
    const v = { max: PHOTO_LIMITS.maxPerLink, supportEmail: SUPPORT_EMAIL, n: '{n}', fileName: '{file name}' }
    return {
      ADD_PHOTOS_LABEL: t('addPhotosLabel'),
      ERROR_TOO_LARGE: t('errorTooLarge'),
      ERROR_TOO_MANY_PHOTOS: t('errorTooManyPhotos', v),
      ERROR_TOO_MANY_TRIES: t('errorTooManyTries'),
      FIELD_PHOTOS_HELP: t('fieldPhotosHelp', v),
      PHOTO_COUNT_TEXT: t('photoCountText', v),
      PHOTO_FAILED_TEXT: t('photoFailedText'),
      PHOTO_LIMIT_REACHED: t('photoLimitReached', v),
      PHOTO_REFUSED: t('photoRefused', v),
      PHOTO_REMOVE_ARIA: t('photoRemoveAria', v),
      REFUSED_DISMISS_ARIA: t('refusedDismissAria', v),
      PHOTO_RETRYING_TEXT: t('photoRetryingText'),
      PHOTO_UPLOADED_ARIA: t('photoUploadedAria', v),
      PHOTO_UPLOADING_ARIA: t('photoUploadingAria', v),
      SHOW_ALL_PHOTOS: t('showAllPhotos', v),
      SHOW_FEWER_PHOTOS: t('showFewerPhotos'),
      THUMB_TAP_TO_RETRY: t('thumbTapToRetry'),
      THUMB_TRYING_AGAIN: t('thumbTryingAgain'),
    } satisfies typeof en
  }, [locale, t])
}
export type PhotoCopy = ReturnType<typeof usePhotoCopy>

/** Maps an English refusal from preparePicked (photo-queue.ts) to the active copy. */
export function localizeRefusal(copy: PhotoCopy, message: string): string {
  if (message === C.ERROR_TOO_LARGE) return copy.ERROR_TOO_LARGE
  if (message === C.PHOTO_REFUSED) return copy.PHOTO_REFUSED
  return message
}
