import policyDoc from './preview-overlay-policy.json'
import { printifyProductIdForPreview } from './printify-id-for-preview'
import type { CatalogSource } from '@/lib/merch/catalog-filter-types'

export type PreviewOverlayPolicyEntry = {
  group: string
  title: string
  siteHref: string | null
  siteProductType: string | null
  showPreviewWordmarkOverlay: boolean
  rationale: string
}

export type PreviewOverlayPolicyCounts = {
  printifyGroupA: number
  printifyGroupB: number
  printifyUnknown: number
  storefrontMapped: number
  storefrontKeepOverlay: number
  storefrontDropOverlay: number
}

const policy = policyDoc as {
  counts: PreviewOverlayPolicyCounts
  byPrintifyProductId: Record<string, PreviewOverlayPolicyEntry>
}

export function previewOverlayPolicyCounts(): PreviewOverlayPolicyCounts {
  return policy.counts
}

export function previewOverlayPolicyEntry(printifyProductId: string | null | undefined): PreviewOverlayPolicyEntry | null {
  if (!printifyProductId?.trim()) return null
  return policy.byPrintifyProductId[printifyProductId.trim()] ?? null
}

export function shouldShowPreviewWordmarkOverlay(input: {
  source: CatalogSource | null
  slug: string
  catalogKey: string
}): { allow: boolean; printifyProductId: string | null; rationale: string | null } {
  const printifyProductId = printifyProductIdForPreview(input)
  const entry = previewOverlayPolicyEntry(printifyProductId)
  if (!entry) {
    return {
      allow: false,
      printifyProductId,
      rationale: 'No overlay policy for this catalog item; default off.',
    }
  }
  return {
    allow: entry.showPreviewWordmarkOverlay,
    printifyProductId,
    rationale: entry.rationale,
  }
}

/** For tests / PR summaries — storefront entries that keep the live name-box. */
export function listStorefrontOverlayKeepers(): PreviewOverlayPolicyEntry[] {
  const seen = new Set<string>()
  const out: PreviewOverlayPolicyEntry[] = []
  for (const [id, entry] of Object.entries(policy.byPrintifyProductId)) {
    if (!entry.showPreviewWordmarkOverlay || !entry.siteHref) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(entry)
  }
  return out.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
}
