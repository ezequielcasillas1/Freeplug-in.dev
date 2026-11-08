import { z } from 'zod'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import { WEBSITE_BUILD_MAX_PAGES, buyoutTierForPages, formatTierPrice, type BuyoutTier } from './tiers'

/**
 * The consultation checklist (Aria's card, Oct 22 2026). ONE shape for both paths: the client fills
 * it on path A ("Fill in the details"); the team fills it after a live session on path B. Stored in
 * consultations.checklist (jsonb). Option lists live here so the form, the admin editor, the summary
 * and the emails all agree.
 */

export const SITE_TYPES = [
  { id: 'service', label: 'Service business (plumber, salon, cleaner…)' },
  { id: 'restaurant', label: 'Restaurant, café or food' },
  { id: 'retail', label: 'Shop or retail' },
  { id: 'professional', label: 'Professional office (law, accounting, health…)' },
  { id: 'portfolio', label: 'Portfolio or personal brand' },
  { id: 'nonprofit', label: 'Nonprofit, church or community group' },
  { id: 'other', label: 'Something else' },
] as const

export const TEMPLATE_CHOICES = [
  { id: 'clean', label: 'Clean & simple' },
  { id: 'bold', label: 'Bold & modern' },
  { id: 'warm', label: 'Warm & local' },
  { id: 'premium', label: 'Premium & elegant' },
  { id: 'team_picks', label: 'Not sure, you pick for me' },
] as const

export const CONTENT_SOURCES = [
  { id: 'ready', label: 'I have my text ready' },
  { id: 'some', label: 'I have some; please help with the rest' },
  { id: 'write_for_me', label: 'Please write it for me' },
] as const

export const PHOTO_SOURCES = [
  { id: 'own', label: 'I have my own photos' },
  { id: 'google', label: 'Use the photos on my Google Business profile' },
  { id: 'stock', label: 'Use good stock photos' },
  { id: 'mix', label: 'A mix' },
] as const

export const DOMAIN_PATHS = [
  { id: 'freeplug', label: 'Get my domain with Freeplug' },
  { id: 'own', label: 'I already have a domain / I will buy it myself (20% off the buyout)' },
] as const

export const FORM_KINDS = [
  { id: 'contact', label: 'Contact form' },
  { id: 'quote', label: 'Quote request' },
  { id: 'newsletter', label: 'Newsletter sign-up' },
  { id: 'job_application', label: 'Job application' },
  { id: 'none', label: 'No forms' },
] as const

export const BOOKING_OPTIONS = [
  { id: 'none', label: 'No online booking' },
  { id: 'link', label: 'Link to a booking tool I already use' },
  { id: 'embedded', label: 'Booking built into the site' },
] as const

export const PAYMENT_OPTIONS = [
  { id: 'none', label: 'No online payments' },
  { id: 'link', label: 'Payment links (deposits, invoices)' },
  { id: 'shop', label: 'A small online shop' },
] as const

export const TIMELINES = [
  { id: 'asap', label: 'As soon as possible' },
  { id: '2_4_weeks', label: 'In 2 to 4 weeks' },
  { id: '1_2_months', label: 'In 1 to 2 months' },
  { id: 'flexible', label: "I'm flexible" },
] as const

export const PLAN_CHOICES = [
  ...PLAN_STEPS.filter((s) => s.sellable).map((s) => ({ id: s.id as string, label: s.name })),
  { id: 'undecided', label: 'Help me choose' },
] as const

/** Own-domain path: the buyout gets 20% off (card). */
export const OWN_DOMAIN_BUYOUT_DISCOUNT = 0.2
export const PAGE_COUNT_MAX = 200

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((o) => o.id) as [T[number]['id'], ...T[number]['id'][]]

const trimmed = (max: number) => z.string().trim().max(max)

/** Draft shape: every field optional so the client can save and come back. */
export const checklistDraftSchema = z
  .object({
    site_type: z.enum(ids(SITE_TYPES)).optional(),
    site_type_other: trimmed(200).optional(),
    page_count: z.coerce.number().int().min(1).max(PAGE_COUNT_MAX).optional(),
    pages_wanted: trimmed(1000).optional(),
    template_choice: z.enum(ids(TEMPLATE_CHOICES)).optional(),
    example_sites: trimmed(1000).optional(),
    content_source: z.enum(ids(CONTENT_SOURCES)).optional(),
    photo_source: z.enum(ids(PHOTO_SOURCES)).optional(),
    content_notes: trimmed(2000).optional(),
    domain_path: z.enum(ids(DOMAIN_PATHS)).optional(),
    domain_name: z
      .string()
      .trim()
      .max(253)
      .refine((s) => s === '' || /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s), 'Enter a domain like mybusiness.com')
      .optional(),
    forms: z.array(z.enum(ids(FORM_KINDS))).max(FORM_KINDS.length).optional(),
    booking: z.enum(ids(BOOKING_OPTIONS)).optional(),
    booking_tool: trimmed(300).optional(),
    payments: z.enum(ids(PAYMENT_OPTIONS)).optional(),
    plan: z.enum(ids(PLAN_CHOICES)).optional(),
    timeline: z.enum(ids(TIMELINES)).optional(),
    deadline_reason: trimmed(500).optional(),
    notes: trimmed(5000).optional(),
  })
  .strict()

export type Checklist = z.infer<typeof checklistDraftSchema>

/** Required before a summary can be sent for review / agreed. */
export const REQUIRED_FIELDS = [
  'site_type',
  'page_count',
  'template_choice',
  'content_source',
  'photo_source',
  'domain_path',
  'forms',
  'booking',
  'payments',
  'plan',
  'timeline',
] as const satisfies readonly (keyof Checklist)[]

export const FIELD_LABELS: Record<keyof Checklist, string> = {
  site_type: 'Type of website',
  site_type_other: 'Type (other)',
  page_count: 'Number of pages',
  pages_wanted: 'Pages you want',
  template_choice: 'Template style',
  example_sites: 'Websites you like',
  content_source: 'Text and content',
  photo_source: 'Photos',
  content_notes: 'Content notes',
  domain_path: 'Domain',
  domain_name: 'Domain name',
  forms: 'Forms',
  booking: 'Booking',
  booking_tool: 'Booking tool',
  payments: 'Payments',
  plan: 'Hosting plan',
  timeline: 'Timeline',
  deadline_reason: 'Why that timeline',
  notes: 'Anything else',
}

/** Drops empty strings / empty arrays so a draft never stores blanks as answers. */
export function cleanChecklistInput(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}

export function parseChecklistDraft(raw: unknown): { ok: true; value: Checklist } | { ok: false; error: string } {
  const r = checklistDraftSchema.safeParse(
    raw && typeof raw === 'object' ? cleanChecklistInput(raw as Record<string, unknown>) : {}
  )
  if (!r.success) {
    return {
      ok: false,
      error: r.error.issues
        .map((i) => {
          const key = i.path[0] as keyof Checklist | undefined
          return key && FIELD_LABELS[key] ? `${FIELD_LABELS[key]}: ${i.message}` : i.message
        })
        .join(' '),
    }
  }
  return { ok: true, value: r.data }
}

/** Missing required answers, as labels (empty = complete). Includes the conditional ones. */
export function missingFields(c: Checklist): string[] {
  const missing: string[] = REQUIRED_FIELDS.filter((k) => {
    const v = c[k]
    return v == null || (Array.isArray(v) && v.length === 0)
  }).map((k) => FIELD_LABELS[k])
  if (c.site_type === 'other' && !c.site_type_other) missing.push(FIELD_LABELS.site_type_other)
  if (c.domain_path === 'own' && !c.domain_name) missing.push(FIELD_LABELS.domain_name)
  if (c.booking === 'link' && !c.booking_tool) missing.push(FIELD_LABELS.booking_tool)
  return missing
}

export function isChecklistComplete(c: Checklist): boolean {
  return missingFields(c).length === 0
}

export type BuyoutPreview = {
  tier: BuyoutTier
  /** null for Custom enterprise (21-35 pages): no fixed price, quoted by hand. */
  baseCents: number | null
  discountCents: number
  totalCents: number | null
  line: string
}

/** The live buyout tier for a page count, with the own-domain 20% discount when it applies. */
/**
 * Oct 30 (Cheke, 7:33 PM CT): there is NO tier above 35 pages. The live line under the page-count
 * input says so plainly instead of "Enter a page count…". Copy pending Sable review.
 */
export const PAGE_COUNT_OVER_MAX_LINE = { en: 'We build up to 35 pages right now.', es: 'Por ahora construimos hasta 35 páginas.' } as const
export const PAGE_COUNT_EMPTY_LINE = { en: 'Enter a page count to see your buyout tier.', es: 'Escribe cuántas páginas para ver tu nivel de compra.' } as const

export function pageCountLine(pageCount: number | undefined, preview: BuyoutPreview | null, lang: 'en' | 'es' = 'en'): string {
  if (preview) return preview.line
  if (pageCount != null && pageCount > WEBSITE_BUILD_MAX_PAGES) return PAGE_COUNT_OVER_MAX_LINE[lang]
  return PAGE_COUNT_EMPTY_LINE[lang]
}

export function buyoutPreview(pageCount: number | undefined, domainPath: Checklist['domain_path']): BuyoutPreview | null {
  if (pageCount == null) return null
  const tier = buyoutTierForPages(pageCount)
  if (!tier) return null
  if (tier.cents == null) {
    return { tier, baseCents: null, discountCents: 0, totalCents: null, line: `${tier.label}: we'll quote it for you. Every dollar you've paid counts toward your quote, and the 20% own-domain discount applies too.` }
  }
  const discountCents = domainPath === 'own' ? Math.round(tier.cents * OWN_DOMAIN_BUYOUT_DISCOUNT) : 0
  const totalCents = tier.cents - discountCents
  const line =
    discountCents > 0
      ? `${tier.label}: buyout ${formatTierPrice(tier.cents)}, ${formatTierPrice(totalCents)} with your own domain (20% off).`
      : `${tier.label}: buyout ${formatTierPrice(tier.cents)}.`
  return { tier, baseCents: tier.cents, discountCents, totalCents, line }
}

function labelFrom(list: readonly { id: string; label: string }[], id: string | undefined): string | undefined {
  return id ? list.find((o) => o.id === id)?.label ?? id : undefined
}

/** Human-readable rows for the summary page, admin view and emails (only answered fields). */
export function checklistSummaryRows(c: Checklist): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const add = (key: keyof Checklist, value: string | undefined) => {
    if (value && value.trim()) rows.push({ label: FIELD_LABELS[key], value })
  }
  add('site_type', labelFrom(SITE_TYPES, c.site_type))
  add('site_type_other', c.site_type_other)
  const preview = buyoutPreview(c.page_count, c.domain_path)
  add('page_count', c.page_count != null ? `${c.page_count}${preview ? ` (${preview.line})` : ''}` : undefined)
  add('pages_wanted', c.pages_wanted)
  add('template_choice', labelFrom(TEMPLATE_CHOICES, c.template_choice))
  add('example_sites', c.example_sites)
  add('content_source', labelFrom(CONTENT_SOURCES, c.content_source))
  add('photo_source', labelFrom(PHOTO_SOURCES, c.photo_source))
  add('content_notes', c.content_notes)
  add('domain_path', labelFrom(DOMAIN_PATHS, c.domain_path))
  add('domain_name', c.domain_name)
  add('forms', c.forms?.map((f) => labelFrom(FORM_KINDS, f)).join(', '))
  add('booking', labelFrom(BOOKING_OPTIONS, c.booking))
  add('booking_tool', c.booking_tool)
  add('payments', labelFrom(PAYMENT_OPTIONS, c.payments))
  add('plan', labelFrom(PLAN_CHOICES, c.plan as PlanStepId | 'undecided' | undefined))
  add('timeline', labelFrom(TIMELINES, c.timeline))
  add('deadline_reason', c.deadline_reason)
  add('notes', c.notes)
  return rows
}

/** Reads checklist values out of a submitted <form>. Shared by the client form and the admin editor. */
export function checklistFromFormData(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(FIELD_LABELS) as (keyof Checklist)[]) {
    if (key === 'forms') {
      out.forms = fd.getAll('forms').map(String)
      continue
    }
    const v = fd.get(key)
    if (v != null) out[key] = String(v)
  }
  return out
}
