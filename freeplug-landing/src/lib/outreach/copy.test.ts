// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as copy from './copy'
import {
  ADMIN_DELETE_PHOTOS_BUTTON,
  ADMIN_DELETE_PHOTOS_CONFIRM,
  ADMIN_FIELD_LABELS,
  ADMIN_CLOSED_APPROVED,
  ADMIN_CLOSED_NO_PHOTOS,
  ADMIN_CLOSED_REJECTED,
  ADMIN_PHOTOS_MOVED_NOTE,
  ADMIN_REJECT_ALREADY_APPLIED,
  ADMIN_REJECT_CONFIRM_BUTTON,
  ADMIN_STALE_NOTE,
  adminDeletePhotosLabel,
  adminRejectConfirm,
  adminServiceLabel,
} from './admin-labels'
import { PHOTO_LIMITS } from './limits'

/**
 * Every customer-facing string in copy.ts must come from Sable's draft word for word, or from
 * Lina's screen map. Sable's 12:35 AM and 12:38 AM sections (Sep 27) cover every line the build
 * wrote itself in round 1, so the NEW list is empty now.
 * The drafts live outside the repo, so the file checks skip when they are not on this machine.
 */
const SABLE = '/workspace/copy/freeplug-outreach-claim-copy-DRAFT-2026-09-26.md'
const LINA = '/workspace/freeplug-qa/design/outreach-claim-screen-map-LINA-2026-09-26.md'

const FROM_LINA = [
  'CLAIMING_FOR_LINE',
  'GO_TO_DASHBOARD_LABEL',
  'VIEW_PREVIEW_LABEL',
  'YOUR_WEBSITE_HEADING',
  'HAVE_DOMAIN_LABEL',
  // Sable 1:04 AM wrote it without the final period; Lina's 1:05 AM note and the round 3 request
  // have "Waiting for us to publish your site." The 1:04 test below checks the words.
  'TRACKER_LIVE_WAITING',
]
const NEW_FOR_SABLE: string[] = []

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
const strings = Object.entries(copy).filter((e): e is [string, string] => typeof e[1] === 'string')

describe('outreach copy', () => {
  it.skipIf(!existsSync(SABLE))("uses Sable's wording for every string not on the Lina or NEW lists", () => {
    const sable = norm(readFileSync(SABLE, 'utf8'))
    const missing = strings.filter(([k, v]) => !FROM_LINA.includes(k) && !NEW_FOR_SABLE.includes(k) && !sable.includes(norm(v)))
    expect(missing).toEqual([])
    // The NEW list really is new (so it stays flagged until Sable adds it).
    for (const k of NEW_FOR_SABLE) expect(sable.includes(norm(String((copy as Record<string, unknown>)[k])))).toBe(false)
  })

  it.skipIf(!existsSync(LINA))("takes the Lina-list strings from Lina's map", () => {
    const lina = norm(readFileSync(LINA, 'utf8'))
    for (const k of FROM_LINA) expect(lina, k).toContain(norm(String((copy as Record<string, unknown>)[k])))
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 3:27 AM section (plan box after Live)", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at327 = all.slice(all.indexOf('## Update Sep 27, 2026, 3:27 AM CT'))
    expect(all.indexOf('## Update Sep 27, 2026, 3:27 AM CT')).toBeGreaterThan(-1)
    expect(at327).toContain(`After Live, if the plan can't be loaded: "${norm(copy.PLAN_LIVE_UNAVAILABLE_MESSAGE)}"`)
    expect(copy.PLAN_LIVE_UNAVAILABLE_MESSAGE).toBe(
      "Your site is live. We couldn't load your plan details right now. Refresh the page to try again, or email support@freeplug-in.dev."
    )
    expect(at327).toContain(`Before Live: unchanged, "${norm(copy.PLAN_WAITING_FOR_PUBLISH_MESSAGE)}"`)
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 4:03 AM section (/dashboard/cancel for outreach customers)", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const head = '## Update Sep 27, 2026, 4:03 AM CT'
    expect(all.indexOf(head)).toBeGreaterThan(-1)
    const at403 = all.slice(all.indexOf(head))
    expect(copy.CANCEL_BEFORE_LIVE_HELP).toBe("If you don't want to go ahead, email support@freeplug-in.dev and we'll help.")
    expect(at403).toContain(`Under it, in grey: "${norm(copy.CANCEL_BEFORE_LIVE_HELP)}"`)
    expect(at403).toContain(`Before Live: the plan-waiting message, "${norm(copy.PLAN_WAITING_FOR_PUBLISH_MESSAGE)}"`)
    expect(at403).toContain('After Live, no plan loaded: the 3:27 line, unchanged.')
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 3:42 AM section (Account card billing line)", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const head = '## Update Sep 27, 2026, 3:42 AM CT'
    expect(all.indexOf(head)).toBeGreaterThan(-1)
    const at342 = all.slice(all.indexOf(head))
    expect(at342).toContain(`Outreach customer, before the card is added: "${norm(copy.ACCOUNT_ADD_CARD_LINE)}"`)
    expect(copy.ACCOUNT_ADD_CARD_LINE).toBe('After you add your card, you can manage your billing and payment method here.')
    expect(at342).toContain('Outreach customer, after Live, still no Stripe customer: show no line.')
    expect(at342).toContain(`The line "${norm(copy.ACCOUNT_FIRST_PAYMENT_LINE)}" shows whenever there's no Stripe customer.`)
    expect(at342).toContain('Regular (non-outreach) customers: no change.')
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 12:35 AM and 12:38 AM sections (Sep 27)", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const start = all.indexOf('## Update Sep 27, 2026, 12:35 AM CT')
    expect(start).toBeGreaterThan(-1)
    const latest = all.slice(start)
    const at1238 = latest.slice(latest.indexOf('## Update Sep 27, 2026, 12:38 AM CT'))
    const c = copy as Record<string, unknown>
    // 12:38 AM: step 4 saves the card only; the waiting screen; the photo box button.
    for (const k of ['STEP4_HEADING', 'STEP4_BODY', 'STEP4_BUTTON', 'STEP4_NOTE', 'CARD_SAVED_LINE', 'WAITING_LINE', 'PLAN_WAITING_FOR_PUBLISH_MESSAGE']) {
      expect(at1238, k).toContain(norm(String(c[k])))
    }
    expect(copy.STEP_NAMES[3]).toBe('Add card')
    expect(at1238).toContain('"Add card"')
    expect(at1238).toContain(`"+ ${copy.ADD_PHOTOS_LABEL}"`)
    // The thank-you line itself keeps its earlier wording ("No wording change").
    expect(at1238).toContain('No wording change')
    expect(at1238).toContain(norm(copy.ADMIN_PUBLISH_CONFIRM))
    expect(at1238).toContain(copy.ADMIN_PUBLISH_BUTTON)
    expect(at1238).toContain(copy.GO_TO_DASHBOARD_LABEL)
    expect(at1238).toContain(copy.VIEW_PREVIEW_LABEL)
    // No "your site is live" email in this version, so the email-promise line must not be used.
    expect(copy.WAITING_LINE).not.toMatch(/email/i)
    // 12:35 AM: replacements and approved lines.
    for (const k of [
      'GENERIC_TRY_AGAIN',
      'PREVIEW_CHANGE_SENT',
      'PHOTO_REMOVE_ARIA',
      'PHOTO_UPLOADING_ARIA',
      'PHOTO_UPLOADED_ARIA',
      'STEP1_BODY',
      'STEP1_BODY_NAME_ONLY',
      'STEP1_BACK_LINK',
      'CLAIM_REOPEN_LINK_LINE',
      'DOMAIN_REQUEST_SENT',
      'CONFIRM_EMAIL_LINE',
    ]) {
      expect(latest, k).toContain(norm(String(c[k])))
    }
    expect(latest).toContain(`"${copy.STEP1_SIGN_IN_PROMPT} ${copy.STEP1_SIGN_IN_LINK}"`)
    // Admin screen (internal): form labels instead of database keys, and the new stale note.
    expect(latest).toContain(norm(ADMIN_STALE_NOTE))
    for (const k of ['hours', 'phone', 'quote_email', 'service_area'] as const) expect(latest, k).toContain(`"${ADMIN_FIELD_LABELS[k]}"`)
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 1:02 AM (admin photo cleanup) and 1:04 AM (tracker) sections", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at102 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:02 AM CT'))
    const at104 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:04 AM CT'))
    expect(at102).toContain('"Delete {n} approved photos from storage"')
    expect(adminDeletePhotosLabel(4)).toBe('Delete 4 approved photos from storage')
    expect(at102).toContain(`"${adminDeletePhotosLabel(1)}"`)
    expect(at102).toContain(`"${norm(ADMIN_DELETE_PHOTOS_CONFIRM)}"`)
    expect(at102).toContain(`"${ADMIN_DELETE_PHOTOS_BUTTON}" / "${copy.ADMIN_CANCEL_BUTTON}"`)
    expect(at104).toContain(`"${copy.TRACKER_LIVE_WAITING.replace(/\.$/, '')}"`)
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 1:18 AM section (carried-photo note, phone check, refused dismiss, services)", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at118 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:18 AM CT'))
    expect(at118.startsWith('## Update Sep 27, 2026, 1:18 AM CT')).toBe(true)
    expect(at118).toContain(`"${norm(ADMIN_PHOTOS_MOVED_NOTE)}"`)
    expect(at118).toContain(`"${copy.PHONE_INVALID}"`)
    expect(at118).toContain(`"${copy.REFUSED_DISMISS_ARIA}"`)
    expect(at118).toContain('"Remove: {service name}"')
    expect(at118).toContain('"Add: {service name}"')
    expect(adminServiceLabel({ name: 'Weeding', keep: false, added: false })).toBe('Remove: Weeding')
    expect(adminServiceLabel({ name: 'Weeding', keep: true, added: true })).toBe('Add: Weeding')
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 1:34 AM (reject confirmation) and 1:36 AM (closed old rows) sections", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at134 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:34 AM CT'), all.indexOf('## Update Sep 27, 2026, 1:36 AM CT'))
    const at136 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:36 AM CT'))
    expect(at134).toContain('"Reject these details? This also rejects the {n} photos sent with them, and they can\'t be approved later."')
    expect(adminRejectConfirm(3)).toBe("Reject these details? This also rejects the 3 photos sent with them, and they can't be approved later.")
    expect(at134).toContain('This also rejects the 1 photo sent with them, and it can\'t be approved later."')
    expect(adminRejectConfirm(1)).toBe("Reject these details? This also rejects the 1 photo sent with them, and it can't be approved later.")
    expect(at134).toContain(`"${ADMIN_REJECT_CONFIRM_BUTTON}" / "${copy.ADMIN_CANCEL_BUTTON}"`)
    expect(at134).toContain(`"${norm(ADMIN_REJECT_ALREADY_APPLIED)}"`)
    for (const line of [ADMIN_CLOSED_APPROVED, ADMIN_CLOSED_REJECTED, ADMIN_CLOSED_NO_PHOTOS, ADMIN_PHOTOS_MOVED_NOTE]) expect(at136).toContain(`"${norm(line)}"`)
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 1:45 AM (stale claim token) and 1:46 AM (claim-start card) sections", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at145 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:45 AM CT'), all.indexOf('## Update Sep 27, 2026, 1:46 AM CT'))
    const at146 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:46 AM CT'))
    expect(at145).toContain(`"${norm(copy.CLAIM_STALE_LINE)}"`)
    expect(at146).toContain(`Heading: "${copy.CLAIM_CARD_HEADING}"`)
    expect(at146).toContain(`normal arrival: "${norm(copy.CLAIM_CARD_LINE)}"`)
    expect(at146).toContain(`stale token (replaces the normal line, same card): "${norm(copy.CLAIM_STALE_LINE)}"`)
    expect(at146).toContain(`Red button: "${copy.CLAIM_LABEL}"`)
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 1:57 AM section (Jace's neutral page, Lina's 1:58 AM phone layout)", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at157 = all.slice(all.indexOf('## Update Sep 27, 2026, 1:57 AM CT'))
    expect(at157).toContain(`Heading: "${norm(copy.NEUTRAL_HEADING)}"`)
    expect(at157).toContain(`Body: "${norm(copy.NEUTRAL_BODY)}"`)
    expect(at157).toContain(`Help line: "${norm(copy.NEUTRAL_HELP_LINE)}"`)
    expect(at157).toContain(`Link: "${copy.GO_TO_DASHBOARD_LABEL}"`)
    expect(at157).toContain(`keep "${norm(copy.NEUTRAL_HELP_PHONE)}" as grey text above the ${copy.CALL_US_LABEL}, ${copy.TEXT_US_LABEL} and ${copy.EMAIL_US_LABEL} buttons`)
    expect(copy.NEUTRAL_HELP_LINE).toBe("Can't find it? Call or text us at 737-392-5612, or email support@freeplug-in.dev.")
  })

  it.skipIf(!existsSync(SABLE))("matches Sable's 2:08 AM (confirm-email line), 2:10 AM (other failures) and 2:22 AM (limited line) sections", () => {
    const all = norm(readFileSync(SABLE, 'utf8'))
    const at208 = all.slice(all.indexOf('## Update Sep 27, 2026, 2:08 AM CT'), all.indexOf('## Update Sep 27, 2026, 2:10 AM CT'))
    const at210 = all.slice(all.indexOf('## Update Sep 27, 2026, 2:10 AM CT'), all.indexOf('## Update Sep 27, 2026, 2:22 AM CT'))
    const at222 = all.slice(all.indexOf('## Update Sep 27, 2026, 2:22 AM CT'))
    const at1235 = all.slice(all.indexOf('## Update Sep 27, 2026, 12:35 AM CT'))
    expect(at208).toContain(`"${norm(copy.CONFIRM_FIRST_LINE)}"`)
    expect(at208).toContain(`"${copy.RESEND_LABEL}". After tapping: "${copy.RESEND_SENT}"`)
    // 2:22 replaces the 2:10 limited line.
    expect(at222).toContain(`New line: "${norm(copy.RESEND_LIMITED)}"`)
    expect(copy.RESEND_LIMITED).toBe('Please wait a few minutes and try again.')
    expect(at210).not.toContain(`"${norm(copy.RESEND_LIMITED)}"`)
    expect(at210).toContain('generic error from the 12:35 section')
    expect(at1235).toContain(norm(copy.GENERIC_TRY_AGAIN))
  })

  it('the replaced 2:10 limited line is gone from every source file (Sable 2:22 AM)', () => {
    const old = ['We just', 'sent one'].join(' ')
    const root = path.join(__dirname, '../..')
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.(tsx?|mjs|js|json|md)$/.test(e.name) && readFileSync(full, 'utf8').includes(old)) hits.push(full)
      }
    }
    walk(root)
    expect(hits).toEqual([])
    for (const v of Object.values(copy)) if (typeof v === 'string') expect(v).not.toContain(old)
  })

  it('claim step 1 body depends on whether the email was pre-filled (Sable 12:35 AM)', () => {
    expect(copy.step1Body('gracia@example.com')).toBe(copy.STEP1_BODY)
    expect(copy.step1Body(null)).toBe("We've filled in your business name. Check it, add your email, and choose a password.")
    expect(copy.step1Body('  ')).toBe(copy.STEP1_BODY_NAME_ONLY)
  })

  it('photo strings match the 12:05 AM spec exactly', () => {
    expect(PHOTO_LIMITS.maxPerLink).toBe(50)
    expect(copy.FIELD_PHOTOS_HELP).toContain('You can send up to 50 photos, 10 MB each (JPG, PNG, WebP, or iPhone HEIC).')
    expect(copy.PHOTO_COUNT_TEXT).toBe('{n} of 50 photos')
    expect(copy.PHOTO_RETRYING_TEXT).toBe('Upload paused. Trying again…')
    expect(copy.PHOTO_FAILED_TEXT).toBe("This photo didn't upload. Tap to try again.")
    expect(copy.PHOTO_LIMIT_REACHED).toBe(
      "You've sent 50 photos, which is the most we can take here. To send more, email support@freeplug-in.dev."
    )
    expect(copy.PHOTO_REFUSED).toBe(
      "We couldn't use this photo. Try it as a JPG or PNG, or email it to support@freeplug-in.dev. It doesn't count toward your 50."
    )
    expect(copy.SHOW_ALL_PHOTOS).toBe('Show all {n} photos')
    expect(copy.SHOW_FEWER_PHOTOS).toBe('Show fewer photos')
    expect(copy.THUMB_TRYING_AGAIN).toBe('Trying again…')
    expect(copy.THUMB_TAP_TO_RETRY).toBe('Tap to try again')
  })

  it('uses the new services intro', () => {
    expect(copy.SERVICES_INTRO).toBe(
      "These are the services on the website we built for you. Keep the ones you offer, remove any you don't, and add any we missed."
    )
  })
})

describe('ClaimStepLine EN catalog matches the locked STEP_NAMES', () => {
  it('auth.signup.claim.stepNames (en) equals STEP_NAMES word for word', async () => {
    const en = (await import('../../../messages/en.json')).default as { auth: { signup: { claim: { stepNames: Record<string, string>; stepLine: string; stepAria: string } } } }
    const c = en.auth.signup.claim
    expect([c.stepNames.account, c.stepNames.details, c.stepNames.plan, c.stepNames.card]).toEqual([...copy.STEP_NAMES])
    expect(c.stepLine).toBe('Step {n} of {total} · {name}')
    expect(c.stepAria).toBe('Step {n} of {total}')
  })
})
