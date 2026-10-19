import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BUY_FOR_ME_CONSENT, DOMAIN_EMAIL_REPLY_TO, domainChoiceSchema, domainStatusStep, renderDomainEmail, submitDomainRequest, type DomainSubmitDeps } from './flow'

function setup(over: Partial<DomainSubmitDeps> = {}, who: Partial<Awaited<ReturnType<DomainSubmitDeps['customer']>>> = {}) {
  const tasks: Promise<void>[] = []
  const deps: DomainSubmitDeps = {
    insert: vi.fn(async () => ({ id: 'req-1', error: null })),
    customer: vi.fn(async () => ({ email: 'ana@example.com', firstName: 'Ana', business: 'Ana Tacos', freeplugUrl: 'https://ana.freeplug-in.dev', locale: null, ...who })),
    sendMail: vi.fn(async () => ({ success: true })),
    alertOwner: vi.fn(),
    background: (_l, task) => void tasks.push(task()),
    now: () => new Date('2026-10-19T16:00:00Z'),
    ...over,
  }
  return { deps, flush: () => Promise.all(tasks) }
}
const ctx = { userId: 'u1', email: 'ana@example.com', locale: 'en' as const }

describe('submitDomainRequest', () => {
  it.each([
    [{ kind: 'have_domain', domain: 'AnaTacos.com', registrar: 'GoDaddy' }, 'en', 'domain-have', "Let's connect anatacos.com to your site"],
    [{ kind: 'buy_self' }, 'es', 'domain-buy-self', 'Cómo comprar tu dominio para Ana Tacos'],
    [{ kind: 'buy_for_me', domain: 'anatacos.com', backupDomain: 'anatacostx.com', consent: true }, 'es', 'domain-we-buy', 'Estamos consiguiendo anatacos.com para ti'],
  ] as const)('%o sends the right template + locale with Reply-To', async (input, locale, template, subject) => {
    const { deps, flush } = setup({}, { locale })
    expect(await submitDomainRequest(input, ctx, deps)).toMatchObject({ ok: true, id: 'req-1' })
    await flush()
    const mail = vi.mocked(deps.sendMail).mock.calls[0][0]
    expect(mail).toMatchObject({ to: 'ana@example.com', template, locale, subject, replyTo: DOMAIN_EMAIL_REPLY_TO, idempotencyKey: 'domain-request:req-1' })
    expect(mail.html).toContain('https://freeplug-in.dev/dashboard/domain')
    expect(mail.html).not.toMatch(/\{[a-z_]+\}/)
    expect(deps.alertOwner).toHaveBeenCalledOnce()
  })

  it('falls back to the request locale when profiles.locale is missing', async () => {
    const { deps, flush } = setup()
    await submitDomainRequest({ kind: 'buy_self' }, { ...ctx, locale: 'es' }, deps)
    await flush()
    expect(vi.mocked(deps.sendMail).mock.calls[0][0].locale).toBe('es')
  })

  it.each([undefined, false, 'true'])('buy_for_me without consent (%s) is refused server-side, nothing saved or sent', async (consent) => {
    const { deps } = setup()
    const r = await submitDomainRequest({ kind: 'buy_for_me', domain: 'anatacos.com', consent }, ctx, deps)
    expect(r).toEqual({ ok: false, error: 'consent_required' })
    expect(deps.insert).not.toHaveBeenCalled()
    expect(deps.sendMail).not.toHaveBeenCalled()
    expect(deps.alertOwner).not.toHaveBeenCalled()
  })

  it('stores consent time, exact wording and locale; owner alert has domain, backup, user, consent time', async () => {
    const { deps } = setup()
    await submitDomainRequest({ kind: 'buy_for_me', domain: 'anatacos.com', backupDomain: 'anatacostx.com', consent: true }, { ...ctx, locale: 'es' }, deps)
    expect(deps.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'buy_for_me', domain: 'anatacos.com', backup_domain: 'anatacostx.com', consent_at: '2026-10-19T16:00:00.000Z', consent_text: BUY_FOR_ME_CONSENT.es, consent_locale: 'es' })
    )
    const a = vi.mocked(deps.alertOwner).mock.calls[0][0]
    expect(a).toMatchObject({ kind: 'domain_request', userId: 'u1', email: 'ana@example.com', dedupeKey: 'domain-request:req-1' })
    const d = Object.fromEntries(a.details)
    expect(d.Domain).toBe('anatacos.com')
    expect(d['Backup choice']).toBe('anatacostx.com')
    expect(d.Consent).toContain('2026-10-19T16:00:00.000Z')
  })

  it('other choices store no consent', async () => {
    const { deps } = setup()
    await submitDomainRequest({ kind: 'have_domain', domain: 'a.com', consent: true }, ctx, deps)
    expect(deps.insert).toHaveBeenCalledWith(expect.objectContaining({ consent_at: null, consent_text: null, consent_locale: null }))
  })

  it('a failed or throwing send never blocks the saved request (and is logged)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const sendMail of [vi.fn(async () => ({ success: false, reason: 'http' })), vi.fn(async () => { throw new Error('boom') })]) {
      const { deps, flush } = setup({ sendMail, alertOwner: vi.fn(() => { throw new Error('alert down') }) })
      expect(await submitDomainRequest({ kind: 'buy_self' }, ctx, deps)).toEqual({ ok: true, id: 'req-1' })
      await flush()
    }
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('a failed insert returns save_failed and sends nothing', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deps } = setup({ insert: vi.fn(async () => ({ id: null, error: 'rls' })) })
    expect(await submitDomainRequest({ kind: 'buy_self' }, ctx, deps)).toEqual({ ok: false, error: 'save_failed' })
    expect(deps.alertOwner).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('rejects a bad domain', async () => {
    const { deps } = setup()
    expect(await submitDomainRequest({ kind: 'have_domain', domain: '<script>' }, ctx, deps)).toEqual({ ok: false, error: 'domain_invalid' })
  })
})

describe('renderDomainEmail', () => {
  it('HTML-escapes user values', () => {
    const { html, subject } = renderDomainEmail('have_domain', 'en', { firstName: '<b>Ana</b>', business: 'Tom & "Jerry\'s"', domain: 'a.com', freeplugUrl: null })
    expect(html).toContain('Hi &lt;b&gt;Ana&lt;/b&gt;,')
    expect(html).toContain('Tom &amp; &quot;Jerry&#39;s&quot;')
    expect(html).not.toContain('<b>Ana</b>')
    expect(subject).toBe("Let's connect a.com to your site")
  })
  it('we-buy keeps the Beta renewal line under step 1 (EN + ES) and the button text', () => {
    expect(renderDomainEmail('buy_for_me', 'en', { firstName: 'A', business: 'B', domain: 'b.com', freeplugUrl: 'x' }).html).toContain("for now, we pay your domain's yearly renewal")
    const es = renderDomainEmail('buy_for_me', 'es', { firstName: null, business: null, domain: 'b.com', freeplugUrl: null }).html
    expect(es).toContain('nosotros pagamos la renovación anual de tu dominio')
    expect(es).toContain('Hola:')
    expect(renderDomainEmail('buy_self', 'en', { firstName: 'A', business: "Joe's Tacos", domain: null, freeplugUrl: 'x' }).html).toContain('joestacos.com')
  })
})

it('status steps', () => {
  expect([domainStatusStep('pending'), domainStatusStep('connecting'), domainStatusStep('live'), domainStatusStep('done')]).toEqual(['saved', 'connecting', 'live', 'live'])
})

describe('domain rule (QA bug 2)', () => {
  const ok = (d: string) => domainChoiceSchema.safeParse({ kind: 'have_domain', domain: d }).success
  it.each(['anatacos.com', 'a.co', 'my-shop.com.mx', 'xn--caf-dma.com', 'joes.xn--p1ai', 'A.COM', `${'a'.repeat(63)}.com`])('accepts %s', (d) => expect(ok(d)).toBe(true))
  it.each(['..com', 'a..b.com', '-a-.com', 'a-.com', '-a.com', `${'a'.repeat(64)}.com`, '.com', 'com', 'a.c', 'a.b-c', 'https://a.com', 'a.com/x', 'café.com', 'a b.com', `${'a.'.repeat(126)}com`])(
    'rejects %s',
    (d) => expect(ok(d)).toBe(false)
  )
  it('backup domain uses the same rule', () => {
    expect(domainChoiceSchema.safeParse({ kind: 'buy_for_me', domain: 'a.com', backupDomain: 'a..b.com', consent: true }).success).toBe(false)
  })
})

describe('migration 20261019120000 (QA bug 1)', () => {
  const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261019120000_domain_requests_flow.sql'), 'utf8')
  it('trigger accepts exactly the official EN + ES consent wording', () => {
    expect(sql).toContain(`'${BUY_FOR_ME_CONSENT.en}'`)
    expect(sql).toContain(`'${BUY_FOR_ME_CONSENT.es}'`)
    expect(sql).toMatch(/new\.consent_at := pg_catalog\.now\(\)/)
    expect(sql).toMatch(/security invoker\s+set search_path = ''/)
    expect(sql).toMatch(/before insert or update on public\.domain_requests/)
  })
  it('every re-added check is NOT VALID then validated; switching to buy_for_me needs the wording', () => {
    const added = [...sql.matchAll(/add constraint (\w+)/g)].map((m) => m[1])
    expect(added.length).toBeGreaterThan(5)
    for (const n of added) expect(sql).toContain(`validate constraint ${n};`)
    expect(sql.match(/not valid;/g)?.length).toBe(added.length)
    expect(sql).toMatch(/new\.kind = 'buy_for_me' and old\.kind is distinct from 'buy_for_me'/)
  })
  it('customers cannot insert directly', () => {
    expect(sql).toContain('drop policy if exists "domain_requests_insert_own"')
    expect(sql).toContain('revoke insert on table public.domain_requests from public, anon, authenticated')
  })
  it('DB domain check uses the same pattern as the app', () => {
    const db = sql.match(/domain ~ '([^']+)'/)![1]
    const re = new RegExp(db)
    for (const d of ['anatacos.com', 'joes.xn--p1ai']) expect(re.test(d)).toBe(true)
    for (const d of ['..com', 'a..b.com', '-a-.com', `${'a'.repeat(64)}.com`]) expect(re.test(d)).toBe(false)
  })
  it.each(['domain_requests_check', 'domain_requests_domain_check', 'domain_requests_kind_check', 'domain_requests_status_check'])('drops live constraint %s by its exact name', (n) => {
    expect(sql).toContain(`drop constraint if exists ${n};`)
  })
})
