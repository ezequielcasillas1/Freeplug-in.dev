import {
  supremeSloganNormalizedStrip,
  supremeSloganStripLayout,
} from '@/lib/merch/shirts/supreme-slogan-strip'
import { getSupremePreviewSpec, isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { MOCKUP_NORMALIZED_SIZE } from '@/lib/merch/preview/preview-overlay-layout'

export type DesignedTeeSloganBBoxIssue = {
  slug: string
  code:
    | 'missing-slogan'
    | 'out-of-bounds'
    | 'clipped-text'
    | 'extra-overlay'
    | 'oversized-panel'
    | 'panel-too-wide'
  detail: string
}

/** Normalized slogan box (0–1) used by audits and capture scripts. */
export function supremeSloganNormalizedBox(slug: string): { left: number; top: number; width: number; height: number } | null {
  const spec = getSupremePreviewSpec(slug)
  if (!spec?.lines?.length) return null
  return supremeSloganNormalizedStrip(spec)
}

const OPAQUE_FILL = /^(?!none$|transparent$).+/i

export function auditDesignedTeeSloganDom(
  slug: string,
  root: Element,
  shirtColor: ShirtColor = 'Black'
): DesignedTeeSloganBBoxIssue[] {
  const issues: DesignedTeeSloganBBoxIssue[] = []
  if (!isSupremeStyleShirtSlug(slug)) return issues

  const sloganSvgs = root.querySelectorAll('[data-testid="designed-tee-slogan-overlay"]')
  const brandSvgs = root.querySelectorAll(
    '[data-testid="merch-shirt-mockup"] .pointer-events-none svg:not([data-testid="designed-tee-slogan-overlay"])'
  )
  if (sloganSvgs.length !== 1) {
    issues.push({
      slug,
      code: 'extra-overlay',
      detail: `expected 1 slogan overlay, found ${sloganSvgs.length}`,
    })
  }
  if (brandSvgs.length > 0) {
    issues.push({
      slug,
      code: 'extra-overlay',
      detail: `unexpected catalog wordmark overlay (${brandSvgs.length})`,
    })
  }

  const spec = getSupremePreviewSpec(slug)
  if (!spec?.lines?.length) {
    issues.push({ slug, code: 'missing-slogan', detail: 'no slogan spec' })
    return issues
  }

  const layout = supremeSloganStripLayout(spec, shirtColor)
  const norm = supremeSloganNormalizedStrip(spec)
  const svg = sloganSvgs[0] as SVGSVGElement | undefined
  if (!svg) return issues

  const maxStripH = norm.height * MOCKUP_NORMALIZED_SIZE * 1.35
  const maxStripW = layout.printMaxW * 1.02
  const rects = [...svg.querySelectorAll('rect')]
  for (const rect of rects) {
    const fill = rect.getAttribute('fill') ?? ''
    if (!OPAQUE_FILL.test(fill)) continue
    const w = Number(rect.getAttribute('width') ?? 0)
    const h = Number(rect.getAttribute('height') ?? 0)
    if (w > maxStripW + 0.5) {
      issues.push({
        slug,
        code: 'panel-too-wide',
        detail: `opaque rect width ${w.toFixed(1)} > print max ${maxStripW.toFixed(1)}`,
      })
    }
    if (h > maxStripH + 0.5) {
      issues.push({
        slug,
        code: 'oversized-panel',
        detail: `opaque rect height ${h.toFixed(1)} > strip max ${maxStripH.toFixed(1)}`,
      })
    }
  }

  const dataW = Number(svg.getAttribute('data-strip-w') ?? 0)
  if (dataW > layout.printMaxW + 0.5) {
    issues.push({
      slug,
      code: 'panel-too-wide',
      detail: `overlay strip width ${dataW.toFixed(1)} > print ${layout.printMaxW.toFixed(1)}`,
    })
  }

  const bbox = svg.getBBox()
  const margin = 2
  if (
    bbox.x < -margin ||
    bbox.y < -margin ||
    bbox.x + bbox.width > MOCKUP_NORMALIZED_SIZE + margin ||
    bbox.y + bbox.height > MOCKUP_NORMALIZED_SIZE + margin
  ) {
    issues.push({
      slug,
      code: 'out-of-bounds',
      detail: `svg bbox ${bbox.x.toFixed(1)},${bbox.y.toFixed(1)} ${bbox.width.toFixed(1)}x${bbox.height.toFixed(1)}`,
    })
  }

  const text = (svg.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (/\.dev|\.in\b/i.test(text)) {
    issues.push({ slug, code: 'clipped-text', detail: `brand wordmark leaked "${text}"` })
  }
  if (text.length > 0 && text.length < 4) {
    issues.push({ slug, code: 'clipped-text', detail: `too short "${text}"` })
  }
  if (text.length && !specLineMatches(slug, text)) {
    issues.push({ slug, code: 'clipped-text', detail: `text does not match spec "${text}"` })
  }

  return issues
}

function specLineMatches(slug: string, rendered: string): boolean {
  const spec = getSupremePreviewSpec(slug)
  if (!spec) return true
  const blob = rendered.replace(/\s+/g, ' ').trim().toUpperCase()
  return spec.lines.some((line) =>
    blob.includes(line.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 6))
  )
}
