import { z } from 'zod'
import { CHANGE_TYPES } from '@/lib/help/help-chat-content'
import { PHONE_INVALID, SERVICE_SOURCE_SITE, SERVICE_SOURCE_SITE_AND_THUMBTACK, SERVICE_SOURCE_THUMBTACK_ONLY } from './copy'
import { normalizePhone } from './phone'
import { PLAN_STEP_IDS } from '@/lib/plans/ladder'

/** Zod limits for every outreach form field (same style as the request form). */
export const DETAIL_KEYS = ['phone', 'address', 'hours', 'service_area', 'quote_email'] as const
export type DetailKey = (typeof DETAIL_KEYS)[number]

const text = (max: number) => z.string().trim().max(max)

/** Empty, or a 10-digit number saved as 512-555-0142 (Vera r2 bug 3, Sable 1:18 AM). */
const phoneValue = z
  .string()
  .trim()
  .max(50)
  .refine((v) => v === '' || normalizePhone(v) !== null, { message: PHONE_INVALID })
  .transform((v) => (v === '' ? '' : (normalizePhone(v) as string)))

export const detailFieldsSchema = z.object({
  phone: phoneValue.default(''),
  address: text(300).default(''),
  hours: text(500).default(''),
  service_area: text(500).default(''),
  quote_email: z
    .string()
    .trim()
    .max(320)
    .default('')
    .refine((v) => v === '' || z.string().email().safeParse(v).success, {
      message: 'Enter a valid email address.',
    }),
})

export const servicesSchema = z
  .array(z.object({ name: text(100).min(1), keep: z.boolean() }))
  .max(50)
  .default([])

export const detailsSubmissionSchema = z.object({
  fields: detailFieldsSchema,
  services: servicesSchema,
})
export type DetailsSubmission = z.infer<typeof detailsSubmissionSchema>

export const changeRequestSchema = z.object({
  changeType: z.enum(CHANGE_TYPES),
  description: text(2000).min(1, 'Describe the change.'),
})

/** Claim step 3: one of the ladder's step ids (src/lib/plans/ladder.ts). The slider and add-ons are retired. */
export const planChoiceSchema = z
  .object({
    planStep: z.enum(PLAN_STEP_IDS),
    // The tipping system: whole dollars; the per-step range is checked in saveChosenPlan (tips.ts).
    tipDollars: z.number().int().min(0).max(500).optional(),
  })
  .strict()

export const prefillEntrySchema = z.object({ value: text(500), source: text(100) })
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), { message: 'Source links must start with https://' })
  .default('')
const adminPrefillEntrySchema = prefillEntrySchema.extend({ source_url: optionalUrl })
export const adminCreateSiteSchema = z.object({
  businessName: text(200).min(1, 'Business name is required.'),
  contactEmail: z
    .string()
    .trim()
    .max(320)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, { message: 'Enter a valid email.' }),
  prefill: z.object({
    phone: adminPrefillEntrySchema.extend({ value: phoneValue }),
    address: adminPrefillEntrySchema,
    hours: adminPrefillEntrySchema,
    service_area: adminPrefillEntrySchema,
    quote_email: adminPrefillEntrySchema,
  }),
  services: z
    .array(z.object({ name: text(100).min(1), source: text(100).default(''), source_url: optionalUrl }))
    .max(50),
})

export const domainRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('have_domain'),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(253)
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Enter a domain like yourbusiness.com'),
  }),
  z.object({ kind: z.literal('need_domain'), domain: z.literal('').optional() }),
])

export type PrefillMap = Partial<Record<DetailKey, { value: string; source: string }>>

/**
 * Only keeps well-formed { value, source } entries for known keys. Zod drops everything else,
 * including the admin-only source_url, so this is what the preview page receives.
 */
export function readPrefill(raw: unknown): PrefillMap {
  const out: PrefillMap = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of DETAIL_KEYS) {
    const parsed = prefillEntrySchema.safeParse((raw as Record<string, unknown>)[key])
    if (parsed.success && parsed.data.value) out[key] = parsed.data
  }
  return out
}

export type ServiceItem = { name: string; source: string }

/**
 * Services with their public source label for the preview / claim form. Uses the admin's
 * service_sources rows (source_url is dropped here) and falls back to the plain names list.
 * An empty label stays empty (no source line).
 */
export function readServiceSources(names: string[] | null | undefined, raw: unknown): ServiceItem[] {
  const labels = new Map<string, string>()
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const p = z.object({ name: text(100), source_label: text(100).nullable().optional() }).safeParse(r)
      if (p.success && p.data.name) labels.set(p.data.name, p.data.source_label ?? '')
    }
  }
  return (names ?? []).map((name) => ({ name, source: serviceSourceLine(labels.get(name)) }))
}

/**
 * Grey line under a service name, always one of Sable's three labels when the source is known:
 * "On your new website", "On your new website and your Thumbtack profile", "From your Thumbtack
 * profile". A bare source such as "Thumbtack profile" (how Rio labels Thumbtack-only services)
 * becomes "From your Thumbtack profile"; any other bare source gets the field-style
 * "From your {source}". Empty stays empty (no line).
 */
export function serviceSourceLine(label: string | null | undefined): string {
  const l = (label ?? '').trim().replace(/\s+/g, ' ')
  if (!l) return ''
  const known = [SERVICE_SOURCE_SITE, SERVICE_SOURCE_SITE_AND_THUMBTACK, SERVICE_SOURCE_THUMBTACK_ONLY]
  const exact = known.find((k) => k.toLowerCase() === l.toLowerCase())
  if (exact) return exact
  if (/^(your )?thumbtack( profile)?$/i.test(l)) return SERVICE_SOURCE_THUMBTACK_ONLY
  if (/^(your )?(new )?(web)?site$/i.test(l)) return SERVICE_SOURCE_SITE
  if (/^(on|from) your /i.test(l)) return l
  return `From your ${l}`
}

/** Label from Rio's optional per-service flags (used only when a file sends flags, not labels). */
export function serviceLabelFromFlags(onSite: boolean | undefined, onThumbtack: boolean | undefined): string {
  if (onSite && onThumbtack) return SERVICE_SOURCE_SITE_AND_THUMBTACK
  if (onSite) return SERVICE_SOURCE_SITE
  if (onThumbtack) return SERVICE_SOURCE_THUMBTACK_ONLY
  return ''
}
