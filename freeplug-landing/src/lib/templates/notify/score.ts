import { matchedNicheTerm, type Niche } from '@/lib/envato/niche-tags'
import { isGeneralTemplate } from '../pick'

/**
 * Team-pick suggestions for the admin email (Aria scope, Oct 14). Deterministic, server-side, no external
 * API. Score out of 100:
 *   40 business-type whole-word match (same rules as the catalog tagger, cleaning rule included);
 *      65 when the request notes are empty (the needs-fit 25 moves here, Aria ruling 4)
 *   25 needs-fit: request NOTES keyword overlap only (5 per shared keyword, max 25)
 *   15 Lina's shortlist confirmation (shortlistPoints below)
 *   10 rating + sales (5 + 5)
 *   10 recency (last update or publish date)
 * Only templates on Elements qualify; ThemeForest-only items never do. Under 3 type matches, the rest is
 * filled from general local-business templates, marked general.
 */
export const SCORE = { typeNoNotes: 65, type: 40, keywords: 25, shortlist: 15, quality: 10, recency: 10 } as const
export const SUGGESTION_COUNT = 3

export type Candidate = {
  id: number
  name: string
  author: string | null
  platform: string | null
  url: string | null
  previewImageUrl: string | null
  tags: string[]
  autoNiches: string[]
  rating: number | null
  sales: number | null
  publishedAt: string | null
  updatedAt: string | null
  onElements: boolean | null
  status: string
}

export type ShortlistRow = { envato_item_id: number; niche: string; verify_status: string; active: boolean }

export type ScoreParts = { type: number; keywords: number; shortlist: number; quality: number; recency: number }

export type Suggestion = {
  id: number
  title: string
  themeforestUrl: string | null
  elementsUrl: string
  previewImageUrl: string | null
  score: number
  parts: ScoreParts
  general: boolean
  reason: string
}

/**
 * The ONE place the 15 shortlist points are decided (Lina may change this). Today: the item is on the
 * existing admin shortlist (template_shortlist), active, confirmed, AND marked for the request's own
 * business type. No fallback: a row for another type earns 0.
 */
export function shortlistPoints(itemId: number, type: string, rows: ShortlistRow[]): number {
  return rows.some((r) => Number(r.envato_item_id) === itemId && r.niche === type && r.active && r.verify_status === 'confirmed')
    ? SCORE.shortlist
    : 0
}

const STOP = new Set(
  'and the for with our your you are from that this have will can all any but not more most also into over just only very per get got its out off near best top new free call now site web page home local service services business company'.split(' '),
)

export function keywords(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []) if (!STOP.has(w)) out.add(w)
  return out
}

function qualityPoints(rating: number | null, sales: number | null): number {
  const r = rating != null && Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) / 5 : 0
  const s = sales != null && sales > 0 ? Math.min(1, Math.log10(sales + 1) / 4) : 0
  return Math.round((r * 5 + s * 5) * 10) / 10
}

const YEAR = 365.25 * 86400_000
function recencyPoints(updatedAt: string | null, publishedAt: string | null, now: Date): number {
  const t = Date.parse(updatedAt ?? publishedAt ?? '')
  if (!Number.isFinite(t)) return 0
  const age = (now.getTime() - t) / YEAR
  if (age <= 1) return SCORE.recency
  if (age >= 4) return 0
  return Math.round(SCORE.recency * ((4 - age) / 3) * 10) / 10
}

/** Elements has no item id mapping in the catalog; the admin gets a title search on Elements. */
export function elementsSearchUrl(title: string): string {
  return `https://elements.envato.com/web-templates?term=${encodeURIComponent(title)}`
}

const TYPE_LABEL = (t: string) => t.replace(/_/g, ' ')

export function reasonLine(s: { general: boolean; parts: ScoreParts }, matched: string | null, overlap: number, type: string): string {
  if (s.general) {
    const bits = [`General local-business template; no match for '${TYPE_LABEL(type)}'.`]
    if (overlap > 0) bits.push(`${overlap} notes keyword${overlap === 1 ? '' : 's'} overlap.`)
    return bits.join(' ')
  }
  const bits = [`Matches '${matched ?? TYPE_LABEL(type)}'`]
  if (overlap > 0) bits.push(`${overlap} notes keyword${overlap === 1 ? '' : 's'} overlap`)
  if (s.parts.shortlist > 0) bits.push("on Lina's shortlist")
  return bits.join('; ') + '.'
}

export type ScoreInput = {
  type: Niche
  notes: string | null
  shortlist: ShortlistRow[]
  now: Date
}

export function scoreCandidate(c: Candidate, input: ScoreInput, general: boolean): Suggestion & { overlap: number } {
  const matched = general ? null : matchedNicheTerm(input.type, { name: c.name, tags: c.tags })
  const notesEmpty = !(input.notes ?? '').trim()
  const want = keywords(input.notes ?? '')
  const have = keywords([c.name, ...c.tags].join(' '))
  let overlap = 0
  for (const w of want) if (have.has(w)) overlap++
  const parts: ScoreParts = {
    type: matched ? (notesEmpty ? SCORE.typeNoNotes : SCORE.type) : 0,
    keywords: Math.min(SCORE.keywords, overlap * 5),
    shortlist: shortlistPoints(c.id, input.type, input.shortlist),
    quality: qualityPoints(c.rating, c.sales),
    recency: recencyPoints(c.updatedAt, c.publishedAt, input.now),
  }
  const score = Math.min(100, Math.round(parts.type + parts.keywords + parts.shortlist + parts.quality + parts.recency))
  const base = { general, parts }
  return {
    id: c.id,
    title: c.name,
    themeforestUrl: c.url,
    elementsUrl: elementsSearchUrl(c.name),
    previewImageUrl: c.previewImageUrl,
    score,
    parts,
    general,
    reason: reasonLine(base, matched, overlap, input.type),
    overlap,
  }
}

const byScore = (a: Suggestion, b: Suggestion) => b.score - a.score || a.id - b.id

/** Top 3 on-Elements suggestions: type matches first, then general fill (marked general). */
export function suggestTemplates(candidates: Candidate[], input: ScoreInput): Suggestion[] {
  const eligible = candidates.filter((c) => c.onElements === true && c.status === 'active')
  const seen = new Set<number>()
  const typed: Suggestion[] = []
  for (const c of eligible) {
    if (seen.has(c.id)) continue
    if (input.type === 'other_local' || !matchedNicheTerm(input.type, { name: c.name, tags: c.tags })) continue
    seen.add(c.id)
    typed.push(strip(scoreCandidate(c, input, false)))
  }
  const top = typed.sort(byScore).slice(0, SUGGESTION_COUNT)
  if (top.length >= SUGGESTION_COUNT) return top
  const general: Suggestion[] = []
  for (const c of eligible) {
    if (seen.has(c.id) || !isGeneralTemplate(c)) continue
    seen.add(c.id)
    general.push(strip(scoreCandidate(c, input, true)))
  }
  return [...top, ...general.sort(byScore).slice(0, SUGGESTION_COUNT - top.length)]
}

function strip(s: Suggestion & { overlap: number }): Suggestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { overlap, ...rest } = s
  return rest
}
