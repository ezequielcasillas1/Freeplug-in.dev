/**
 * "Set up your domain" (Oct 19 2026). Pure logic + injected I/O so every path is unit-tested:
 * validation (Buy-for-me consent is enforced HERE, not only in the browser), the customer's email
 * (Lina's final HTML, EN/ES) and the owner alert for every request. There is NO purchase flow:
 * "Buy a domain for me" is saved as a request and handled by hand. Sends never block the save.
 */
import { z } from 'zod'
import { DOMAIN_EMAIL_TEMPLATES } from './templates.generated'

export type DomainKind = 'have_domain' | 'buy_for_me' | 'buy_self'
export type DomainLocale = 'en' | 'es'
export const DOMAIN_KINDS: readonly DomainKind[] = ['have_domain', 'buy_for_me', 'buy_self']

export const DASHBOARD_DOMAIN_URL = 'https://freeplug-in.dev/dashboard/domain'
export const DOMAIN_EMAIL_REPLY_TO = '72afterconsulting@gmail.com'

/** Sable's final consent wording; the exact string shown is what gets stored. */
export const BUY_FOR_ME_CONSENT: Record<DomainLocale, string> = {
  en: 'I understand that if this offer changes, Freeplug may charge my card on file for the yearly domain renewal, and will tell me before it does.',
  es: 'Entiendo que, si esta oferta cambia, Freeplug podría cobrar la renovación anual del dominio a mi tarjeta registrada y me avisará antes de hacerlo.',
}

export const DOMAIN_INVALID = 'domain_invalid'
export const CONSENT_REQUIRED = 'consent_required'

const domainField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, DOMAIN_INVALID)
  .max(253, DOMAIN_INVALID)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, DOMAIN_INVALID)
const optionalDomain = z.union([z.literal(''), domainField]).optional()

export const domainChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('have_domain'), domain: domainField, registrar: z.string().trim().max(100).optional() }),
  z.object({
    kind: z.literal('buy_for_me'),
    domain: domainField,
    backupDomain: optionalDomain,
    consent: z.literal(true, { message: CONSENT_REQUIRED }),
  }),
  z.object({ kind: z.literal('buy_self') }),
])
export type DomainChoice = z.infer<typeof domainChoiceSchema>

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const oneLine = (s: string, max = 200) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max)

/** "Joe's Tacos" -> "joestacos.com" (example only, in the buy-self email). */
export function exampleDomain(business: string): string {
  const slug = business
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40)
  return `${slug || 'yourbusiness'}.com`
}

export type DomainEmailVars = { firstName: string | null; business: string | null; domain: string | null; freeplugUrl: string | null }

const TEMPLATE_KEY: Record<DomainKind, 'have' | 'buy-self' | 'we-buy'> = { have_domain: 'have', buy_self: 'buy-self', buy_for_me: 'we-buy' }
export const domainTemplateName = (kind: DomainKind) => `domain-${TEMPLATE_KEY[kind]}`

const FALLBACK = {
  en: { business: 'your business', freeplugUrl: 'your Freeplug web address', domain: 'your domain' },
  es: { business: 'tu negocio', freeplugUrl: 'tu dirección web de Freeplug', domain: 'tu dominio' },
}

/** Lina's HTML with every value HTML-escaped. Subject is plain text (single line). */
export function renderDomainEmail(kind: DomainKind, locale: DomainLocale, v: DomainEmailVars) {
  const t = DOMAIN_EMAIL_TEMPLATES[`${TEMPLATE_KEY[kind]}:${locale}`]
  const f = FALLBACK[locale]
  const business = oneLine(v.business ?? '') || f.business
  const vals: Record<string, string> = {
    first_name: oneLine(v.firstName ?? '', 80),
    business,
    domain: oneLine(v.domain ?? '', 253) || f.domain,
    example_domain: exampleDomain(business),
    freeplug_url: oneLine(v.freeplugUrl ?? '', 300) || f.freeplugUrl,
    dashboard_domain_url: DASHBOARD_DOMAIN_URL,
  }
  let html: string = t.html
  // No name: "Hi there," / "Hola:" instead of an empty greeting.
  if (!vals.first_name) html = html.replace('Hi {first_name},', 'Hi there,').replace('Hola, {first_name}:', 'Hola:')
  html = html.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vals ? escapeHtml(vals[k]) : m))
  const subject = t.subject.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vals ? vals[k] : m))
  const text = html
    .replace(/<(br|\/p|\/div|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
  return { subject, html, text: `${text}\n\n${DASHBOARD_DOMAIN_URL}` }
}

export const KIND_LABEL: Record<DomainKind, string> = {
  have_domain: 'I already have a domain',
  buy_for_me: 'Buy a domain for me (BETA)',
  buy_self: "I'll buy my own domain",
}

export type DomainRow = {
  user_id: string
  kind: DomainKind
  domain: string | null
  registrar: string | null
  backup_domain: string | null
  locale: DomainLocale
  consent_at: string | null
  consent_text: string | null
  consent_locale: DomainLocale | null
}

export type DomainSubmitDeps = {
  insert: (row: DomainRow) => Promise<{ id: string | null; error: string | null }>
  /** Customer details for the email; may be slow, runs in the background. */
  customer: () => Promise<{ email: string | null; firstName: string | null; business: string | null; freeplugUrl: string | null; locale: DomainLocale | null }>
  sendMail: (p: {
    to: string
    subject: string
    html: string
    text: string
    replyTo: string
    idempotencyKey: string
    template: string
    locale: string
  }) => Promise<{ success: boolean; reason?: string }>
  alertOwner: (a: { kind: 'domain_request'; dedupeKey: string; userId: string; email: string | null; details: [string, string | null][]; adminPath: string }) => void
  background: (label: string, task: () => Promise<void>) => void
  now: () => Date
}

export type DomainSubmitResult = { ok: true; id: string | null } | { ok: false; error: 'invalid' | typeof DOMAIN_INVALID | typeof CONSENT_REQUIRED | 'save_failed' }

export async function submitDomainRequest(
  input: unknown,
  ctx: { userId: string; email: string | null; locale: DomainLocale },
  deps: DomainSubmitDeps
): Promise<DomainSubmitResult> {
  const parsed = domainChoiceSchema.safeParse(input)
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => i.message)
    if (msgs.includes(CONSENT_REQUIRED) || parsed.error.issues.some((i) => i.path[0] === 'consent')) return { ok: false, error: CONSENT_REQUIRED }
    if (msgs.includes(DOMAIN_INVALID)) return { ok: false, error: DOMAIN_INVALID }
    return { ok: false, error: 'invalid' }
  }
  const c = parsed.data
  const at = deps.now().toISOString()
  const row: DomainRow = {
    user_id: ctx.userId,
    kind: c.kind,
    domain: c.kind === 'buy_self' ? null : c.domain,
    registrar: c.kind === 'have_domain' ? oneLine(c.registrar ?? '', 100) || null : null,
    backup_domain: c.kind === 'buy_for_me' ? c.backupDomain || null : null,
    locale: ctx.locale,
    consent_at: c.kind === 'buy_for_me' ? at : null,
    consent_text: c.kind === 'buy_for_me' ? BUY_FOR_ME_CONSENT[ctx.locale] : null,
    consent_locale: c.kind === 'buy_for_me' ? ctx.locale : null,
  }
  const saved = await deps.insert(row)
  if (saved.error) {
    console.error('[domain-request] not saved', saved.error)
    return { ok: false, error: 'save_failed' }
  }
  const key = saved.id ?? `${ctx.userId}:${at}`

  try {
    deps.alertOwner({
      kind: 'domain_request',
      dedupeKey: `domain-request:${key}`,
      userId: ctx.userId,
      email: ctx.email,
      details: [
        ['Choice', KIND_LABEL[c.kind]],
        ['Domain', row.domain],
        ['Where bought', row.registrar],
        ['Backup choice', row.backup_domain],
        ['Consent', row.consent_at ? `${row.consent_at} (${row.consent_locale}): ${row.consent_text}` : null],
        ['Language', ctx.locale],
        ['Next step', c.kind === 'buy_for_me' ? 'Buy by hand (no automatic purchase). If taken, email options first.' : null],
      ],
      adminPath: '/admin/outreach',
    })
  } catch (e) {
    console.error('[domain-request] owner alert failed', e instanceof Error ? e.message : e)
  }

  try {
    deps.background('domain-request-email', async () => {
      try {
        const who = await deps.customer()
        const to = who.email ?? ctx.email
        if (!to) return console.error('[domain-request] no customer email; confirmation not sent', key)
        const locale = who.locale ?? ctx.locale
        const mail = renderDomainEmail(c.kind, locale, { firstName: who.firstName, business: who.business, domain: row.domain, freeplugUrl: who.freeplugUrl })
        const r = await deps.sendMail({
          to,
          ...mail,
          replyTo: DOMAIN_EMAIL_REPLY_TO,
          idempotencyKey: `domain-request:${key}`,
          template: domainTemplateName(c.kind),
          locale,
        })
        if (!r.success) console.error('[domain-request] confirmation not sent', domainTemplateName(c.kind), r.reason)
      } catch (e) {
        console.error('[domain-request] confirmation failed', e instanceof Error ? e.message : e)
      }
    })
  } catch (e) {
    console.error('[domain-request] schedule failed', e instanceof Error ? e.message : e)
  }
  return { ok: true, id: saved.id }
}

/** Status step for the page: pending = Request saved, connecting, live/done = Live. */
export function domainStatusStep(status: string | null | undefined): 'saved' | 'connecting' | 'live' {
  return status === 'connecting' ? 'connecting' : status === 'live' || status === 'done' ? 'live' : 'saved'
}
