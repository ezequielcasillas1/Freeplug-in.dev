'use client'

import { useSearchParams } from 'next/navigation'

/** Reads `preview=0` from the URL to hide mockup overlays on catalog and PDP views. */
export function usePreviewOverlaysEnabled(): boolean {
  const params = useSearchParams()
  const preview = params.get('preview')
  if (preview === '0' || preview === 'false') return false
  return true
}
