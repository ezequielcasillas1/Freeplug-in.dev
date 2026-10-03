import { z } from 'zod'
import { DETAIL_KEYS, serviceLabelFromFlags, serviceSourceLine, type DetailKey } from './schemas'

/**
 * Rio's per-business pre-fill file (spec, Sep 27 12:00 AM):
 * { business_name, email, fields: { phone|address|hours|service_area|quote_email:
 *   { value, source_label, source_url } }, services: [ { name, source_label, source_url } ] }
 * Used by the admin "New outreach site" form (paste or upload). source_url is admin-only: it is
 * stored for the admin list and never sent to the preview page.
 */
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v ?? '')
const nullableUrl = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => v ?? '')
  .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), { message: 'source_url must start with http(s)://' })

/**
 * Rio's real files send some values as a list (service_area: ["San Marcos, TX"]); lists are
 * joined with ", " into the one text value the form edits.
 */
const rioValueSchema = z
  .union([z.string().trim().max(500), z.array(z.string().trim().min(1).max(200)).max(30)])
  .nullable()
  .optional()
  .transform((v) => (Array.isArray(v) ? v.join(', ') : (v ?? '')))
  .refine((v) => v.length <= 500, { message: 'value is too long' })

const rioFieldSchema = z
  .object({ value: rioValueSchema, source_label: nullableText(100), source_url: nullableUrl })
  .strict()

export const rioImportSchema = z
  .object({
    business_name: z.string().trim().min(1, 'business_name is required').max(200),
    email: z
      .string()
      .trim()
      .max(320)
      .nullable()
      .optional()
      .transform((v) => v ?? '')
      .refine((v) => v === '' || z.string().email().safeParse(v).success, { message: 'email is not valid' }),
    fields: z
      .object({
        phone: rioFieldSchema.optional(),
        address: rioFieldSchema.optional(),
        hours: rioFieldSchema.optional(),
        service_area: rioFieldSchema.optional(),
        quote_email: rioFieldSchema.optional(),
      })
      .strict()
      .default({}),
    // One entry per service on the site we built (site order), plus any Thumbtack-only ones.
    // Where it came from is either a label (Rio's files today) or optional flags; both accepted.
    services: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            source_label: nullableText(100),
            source_url: nullableUrl,
            on_site: z.boolean().optional(),
            on_thumbtack: z.boolean().optional(),
          })
          .strict()
      )
      .max(50)
      .default([]),
  })
  .strict()

export type RioImport = z.infer<typeof rioImportSchema>

export type AdminPrefillEntry = { value: string; source: string; source_url: string }
export type AdminServiceEntry = { name: string; source: string; source_url: string }
export type AdminSiteFormValues = {
  businessName: string
  contactEmail: string
  prefill: Record<DetailKey, AdminPrefillEntry>
  services: AdminServiceEntry[]
}

export function emptyAdminSiteForm(): AdminSiteFormValues {
  const prefill = {} as Record<DetailKey, AdminPrefillEntry>
  for (const k of DETAIL_KEYS) prefill[k] = { value: '', source: '', source_url: '' }
  return { businessName: '', contactEmail: '', prefill, services: [] }
}

/** Parses Rio's JSON text; returns form values or a readable error for the admin. */
export function parseRioImport(text: string): { ok: true; values: AdminSiteFormValues } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That is not valid JSON.' }
  }
  const parsed = rioImportSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: `${issue?.path.join('.') || 'file'}: ${issue?.message ?? 'invalid'}` }
  }
  const values = emptyAdminSiteForm()
  values.businessName = parsed.data.business_name
  values.contactEmail = parsed.data.email
  for (const k of DETAIL_KEYS) {
    const f = parsed.data.fields[k]
    // An empty value never keeps a source label (it renders Sable's blank-field line instead).
    if (f && f.value) values.prefill[k] = { value: f.value, source: f.source_label, source_url: f.source_url }
  }
  const seen = new Set<string>()
  values.services = []
  for (const s of parsed.data.services) {
    const key = s.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label = s.source_label ? serviceSourceLine(s.source_label) : serviceLabelFromFlags(s.on_site, s.on_thumbtack)
    // No source link in the file means no link anywhere (admin list included).
    values.services.push({ name: s.name, source: label, source_url: s.source_url })
  }
  return { ok: true, values }
}
