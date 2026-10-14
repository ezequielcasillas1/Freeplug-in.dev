import { NICHE_LABEL, isNiche } from '@/lib/envato/niche-tags'
import { escapeHtml as e, headerSafe, safeUrl } from './escape'
import type { Suggestion } from './score'

/**
 * Admin-only emails for template picks. Single column, 600px max, system fonts, inline CSS, brand red
 * for links only. Every value is escaped; subjects are single-line. No secrets and no customer contact
 * details (business name only).
 */
export const BRAND_RED = '#ba3d3d'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const CT = 'America/Chicago'

export type NotifyEvent = 'picked' | 'changed' | 'team_pick'

export type PickDetails = {
  requestId: string
  businessName: string
  businessType: string | null
  choice: string
  title: string | null
  author: string | null
  platform: string | null
  themeforestUrl: string | null
  elementsUrl: string | null
  previewImageUrl: string | null
  onElements: boolean | null
  /** Only for a customer-buys pick (client_purchase). */
  priceCents: number | null
  pickedAt: Date
  windowClosesAt: Date | null
}

export type Email = { subject: string; html: string; text: string }

export function formatCt(d: Date | null): string {
  if (!d) return '(not started)'
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: CT, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(d) + ' CT'
  )
}

function typeLabel(t: string | null): string {
  if (!t) return '(not set)'
  return isNiche(t) ? NICHE_LABEL[t] : t
}
function platformLabel(p: string | null): string {
  if (!p) return '(unknown)'
  const v = p.toLowerCase()
  return v === 'wp' ? 'WordPress' : v === 'html' ? 'HTML' : p
}
function money(c: number | null): string {
  return c == null ? '(unknown)' : `$${(c / 100).toFixed(2)}`
}

export function subjectFor(ev: NotifyEvent, businessName: string, requestId: string): string {
  const prefix = ev === 'picked' ? 'Template picked' : ev === 'changed' ? 'Template changed' : 'Team pick suggestions'
  return `${prefix}: ${headerSafe(businessName, 120)} (request ${headerSafe(requestId, 64)})`
}

const wrap = (inner: string) =>
  `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
  `<div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:#1a1a1a;">` +
  inner +
  `</div></body></html>`

const line = (label: string, value: string) =>
  `<div style="margin:0 0 4px 0;"><span style="color:#64748b;">${e(label)}:</span> ${e(value)}</div>`

function link(label: string, url: string | null): string {
  const u = safeUrl(url)
  if (!u) return `<div style="margin:0 0 4px 0;color:#64748b;">${e(label)}: (none)</div>`
  return `<div style="margin:0 0 4px 0;"><a href="${e(u)}" style="color:${BRAND_RED};text-decoration:underline;">${e(label)}</a></div>`
}

function thumb(url: string | null, alt: string): string {
  const u = safeUrl(url)
  return u
    ? `<img src="${e(u)}" alt="${e(alt)}" width="568" style="display:block;width:100%;max-width:568px;height:auto;border:1px solid #e2e8f0;margin:8px 0 12px 0;">`
    : ''
}

export function pickEmail(ev: 'picked' | 'changed', d: PickDetails): Email {
  const title = d.title ?? (d.choice === 'client_pasted' ? 'Pasted ThemeForest link' : '(no title)')
  const rows: [string, string][] = [
    ['Business', d.businessName],
    ['Type', typeLabel(d.businessType)],
    ['Choice type', d.choice],
    ['Window closes', formatCt(d.windowClosesAt)],
    ['Picked at', formatCt(d.pickedAt)],
    ['Request ID', d.requestId],
    ['Author', d.author ?? '(unknown)'],
    ['HTML/WP', platformLabel(d.platform)],
    ['On Elements', d.onElements == null ? '(unknown)' : d.onElements ? 'Yes' : 'No'],
  ]
  if (d.choice === 'client_purchase') rows.push(['Price (customer buys)', money(d.priceCents)])
  const head = ev === 'changed' ? 'The customer changed their template pick (latest pick below).' : 'A customer picked a template.'
  const html = wrap(
    `<div style="margin:0 0 8px 0;color:#64748b;">${e(head)}</div>` +
      `<div style="font-size:18px;font-weight:600;margin:0 0 4px 0;">${e(title)}</div>` +
      thumb(d.previewImageUrl, title) +
      rows.map(([k, v]) => line(k, v)).join('') +
      `<div style="height:12px;"></div>` +
      link('ThemeForest', d.themeforestUrl) +
      link('Elements', d.elementsUrl),
  )
  const text = [head, '', title, ...rows.map(([k, v]) => `${k}: ${headerSafe(v, 500)}`), '',
    `ThemeForest: ${safeUrl(d.themeforestUrl) ?? '(none)'}`, `Elements: ${safeUrl(d.elementsUrl) ?? '(none)'}`].join('\n')
  return { subject: subjectFor(ev, d.businessName, d.requestId), html, text }
}

export type TeamPickDetails = {
  requestId: string
  businessName: string
  businessType: string | null
  pickedAt: Date
  windowClosesAt: Date | null
  suggestions: Suggestion[]
}

function card(s: Suggestion): string {
  const tag = s.general
    ? ` <span style="display:inline-block;background:#e2e8f0;color:#475569;font-size:12px;padding:1px 6px;border-radius:3px;vertical-align:middle;">General</span>`
    : ''
  return (
    `<div style="border:1px solid #e2e8f0;padding:12px;margin:0 0 12px 0;">` +
    `<div style="font-size:16px;font-weight:600;">${e(s.title)}${tag}</div>` +
    thumb(s.previewImageUrl, s.title) +
    `<div style="margin:0 0 4px 0;">${e(`${s.score}/100`)}</div>` +
    `<div style="margin:0 0 8px 0;">${e(s.reason)}</div>` +
    link('ThemeForest', s.themeforestUrl) +
    link('Elements', s.elementsUrl) +
    `</div>`
  )
}

/** Sable's copy for a short team-pick list (the email always goes out, even with 0). */
export function shortfallLine(n: number, businessType: string): string {
  if (n >= 3) return ''
  if (n === 0) return `No Elements matches for '${businessType}'. Lina will hand-pick suggestions.`
  if (n === 1) return `Only 1 Elements match for '${businessType}'. Lina will hand-pick the rest.`
  return `Only ${n} Elements matches for '${businessType}'. Lina will hand-pick the rest.`
}

export function teamPickEmail(d: TeamPickDetails): Email {
  const list = [...d.suggestions].sort((a, b) => b.score - a.score || a.id - b.id)
  const rows: [string, string][] = [
    ['Business', d.businessName],
    ['Type', typeLabel(d.businessType)],
    ['Choice type', 'team_pick'],
    ['Window closes', formatCt(d.windowClosesAt)],
    ['Picked at', formatCt(d.pickedAt)],
    ['Request ID', d.requestId],
  ]
  const note = shortfallLine(list.length, typeLabel(d.businessType))
  const html = wrap(
    `<div style="margin:0 0 8px 0;color:#64748b;">The customer asked the team to pick. Suggestions (on Elements only), highest score first.</div>` +
      rows.map(([k, v]) => line(k, v)).join('') +
      `<div style="height:12px;"></div>` +
      (note ? `<div style="margin:0 0 12px 0;color:#64748b;">${e(note)}</div>` : '') +
      list.map(card).join(''),
  )
  const text = [
    'The customer asked the team to pick.',
    ...rows.map(([k, v]) => `${k}: ${headerSafe(v, 500)}`),
    note,
    '',
    ...list.map((s, i) =>
      [`${i + 1}. ${s.title}${s.general ? ' [General]' : ''}`, `   ${s.score}/100`, `   ${s.reason}`,
        `   ThemeForest: ${safeUrl(s.themeforestUrl) ?? '(none)'}`, `   Elements: ${safeUrl(s.elementsUrl) ?? '(none)'}`].join('\n'),
    ),
  ].join('\n')
  return { subject: subjectFor('team_pick', d.businessName, d.requestId), html, text }
}
