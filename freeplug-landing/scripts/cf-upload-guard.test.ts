// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runGuard } from './cf-upload-guard.mjs'

// FAKE live-looking values: shaped like the real thing, but not credentials.
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const FAKE = {
  sk: 'sk_live_FAKEfake0000notreal1234',
  rk: 'rk_live_FAKEfake0000notreal5678',
  pk: 'pk_live_FAKEfake0000notreal9012',
  whsec: 'whsec_FAKEfake0000notreal0000abcd',
  serviceJwt: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64({ iss: 'supabase', ref: 'ldlyjoybppmwvvcarewq', role: 'service_role' })}.FAKEsignatureFAKEsignature`,
  anonJwt: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64({ iss: 'supabase', ref: 'ldlyjoybppmwvvcarewq', role: 'anon' })}.FAKEsignatureFAKEsignature`,
  liveUrl: 'https://ldlyjoybppmwvvcarewq.supabase.co',
  resend: 're_FAKE1234_fakefakefakefake00',
  smtp: 'Tr0ub4dor-fake-but-real-looking',
}

const CLEAN_WRANGLER = `{
  // comment with "quotes" and a url https://example.com
  "name": "freeplug",
  "vars": { "TRUST_CF_CONNECTING_IP": "true", },
  "env": { "preview": { "vars": { "TRUST_CF_CONNECTING_IP": "true" } } },
}`

let dirs: string[] = []
function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cf-guard-'))
  dirs.push(root)
  const all = { 'wrangler.jsonc': CLEAN_WRANGLER, '.open-next/worker.js': 'export default {}', '.open-next/assets/a.js': 'console.log(1)', ...files }
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    writeFileSync(path.join(root, rel), text)
  }
  return root
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})
const checks = (r: { findings: { check: string; where: string }[] }) => r.findings.map((f) => `${f.check} @ ${f.where}`)
const DUMMY_ENV = { STRIPE_SECRET_KEY: 'sk_test_dummy_not_a_real_key', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SMTP_PASS: 'dummy-local-only' }

describe('upload guard (scripts/cf-upload-guard.mjs)', () => {
  it('passes a clean project with dummy/test values (and the sk_live_ text in .env.example comments)', () => {
    const root = project({
      '.dev.vars': 'STRIPE_SECRET_KEY=sk_test_dummy_local_only\nSTRIPE_WEBHOOK_SECRET=whsec_dummy_local_only\nRESEND_API_KEY=\nSMTP_PASS=dummy\n',
      '.env.example': '# must start with sk_test_ or sk_live_\n',
    })
    expect(checks(runGuard({ root, env: DUMMY_ENV }))).toEqual([])
  })

  it('trips on live keys in the build env, by name, for each marker', () => {
    const root = project({})
    const env = {
      STRIPE_SECRET_KEY: FAKE.sk,
      STRIPE_RESTRICTED: FAKE.rk,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: FAKE.pk,
      STRIPE_WEBHOOK_SECRET: FAKE.whsec,
      NEXT_PUBLIC_SUPABASE_URL: FAKE.liveUrl,
      SUPABASE_SERVICE_ROLE_KEY: FAKE.serviceJwt,
      RESEND_API_KEY: FAKE.resend,
      SMTP_PASS: FAKE.smtp,
    }
    expect(checks(runGuard({ root, env }))).toEqual(
      expect.arrayContaining([
        'stripe-live-secret-key (sk_live_/rk_live_) @ env:STRIPE_SECRET_KEY',
        'stripe-live-secret-key (sk_live_/rk_live_) @ env:STRIPE_RESTRICTED',
        'stripe-live-publishable-key (pk_live_) @ env:NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        'supabase-live-project-ref @ env:NEXT_PUBLIC_SUPABASE_URL',
        'supabase-service-role-jwt (live project) @ env:SUPABASE_SERVICE_ROLE_KEY',
        'resend-api-key-set-to-real-value @ env:RESEND_API_KEY',
        'smtp-pass-set-to-real-value @ env:SMTP_PASS',
        'stripe-webhook-secret-next-to-live-key (likely live mode) @ env:STRIPE_WEBHOOK_SECRET',
      ])
    )
  })

  it('a whsec_ alone (test-mode keys around it) is not flagged: mode is not detectable from it', () => {
    const root = project({})
    expect(checks(runGuard({ root, env: { ...DUMMY_ENV, STRIPE_WEBHOOK_SECRET: FAKE.whsec } }))).toEqual([])
  })

  it('trips on .dev.vars and .env.local', () => {
    const root = project({ '.dev.vars': `STRIPE_SECRET_KEY=${FAKE.sk}\n`, '.env.local': `SUPABASE_SERVICE_ROLE_KEY="${FAKE.serviceJwt}"\n` })
    expect(checks(runGuard({ root, env: DUMMY_ENV }))).toEqual([
      'supabase-service-role-jwt (live project) @ .env.local:SUPABASE_SERVICE_ROLE_KEY',
      'stripe-live-secret-key (sk_live_/rk_live_) @ .dev.vars:STRIPE_SECRET_KEY',
    ])
  })

  it('trips on wrangler vars (top level and env.preview), including any secret name in plain vars', () => {
    const root = project({
      'wrangler.jsonc': `{ "vars": { "NEXT_PUBLIC_SUPABASE_URL": "${FAKE.liveUrl}" }, // live\n "env": { "preview": { "vars": { "SMTP_PASS": "${FAKE.smtp}" } } } }`,
    })
    expect(checks(runGuard({ root, env: DUMMY_ENV }))).toEqual([
      'supabase-live-project-ref @ wrangler.jsonc:vars:NEXT_PUBLIC_SUPABASE_URL',
      'smtp-pass-set-to-real-value @ wrangler.jsonc:env.preview.vars:SMTP_PASS',
      'secret-in-plain-wrangler-vars (use versions secret put) @ wrangler.jsonc:env.preview.vars:SMTP_PASS',
    ])
  })

  it('trips on the built bundle: baked keys, JWTs, whsec, resend keys and env secret values', () => {
    const root = project({
      '.open-next/server-functions/default/handler.mjs': `const a="${FAKE.sk}";const b="${FAKE.serviceJwt}";const c="${FAKE.whsec}"`,
      '.open-next/assets/_next/static/chunks/app.js': `x("${FAKE.pk}","${FAKE.anonJwt}","${FAKE.resend}")`,
      '.open-next/cloudflare/next-env.mjs': `export const p = "${FAKE.smtp}"`,
    })
    const out = checks(runGuard({ root, env: { ...DUMMY_ENV, SMTP_PASS: FAKE.smtp } }))
    expect(out).toEqual(
      expect.arrayContaining([
        'stripe-live-secret-key (sk_live_/rk_live_) @ bundle:.open-next/server-functions/default/handler.mjs',
        'supabase-service-role-jwt (live project) @ bundle:.open-next/server-functions/default/handler.mjs',
        'stripe-webhook-secret-in-bundle @ bundle:.open-next/server-functions/default/handler.mjs',
        'stripe-live-publishable-key (pk_live_) @ bundle:.open-next/assets/_next/static/chunks/app.js',
        'supabase-live-project-jwt (anon) @ bundle:.open-next/assets/_next/static/chunks/app.js',
        'resend-api-key-in-bundle @ bundle:.open-next/assets/_next/static/chunks/app.js',
        'env-secret-value-in-bundle (SMTP_PASS) @ bundle:.open-next/cloudflare/next-env.mjs',
      ])
    )
  })

  it('refuses when there is no bundle', () => {
    const root = project({})
    rmSync(path.join(root, '.open-next'), { recursive: true })
    expect(checks(runGuard({ root, env: DUMMY_ENV }))).toEqual(['bundle-missing (run opennextjs-cloudflare build first) @ .open-next'])
  })

  describe('production override (FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes, Jace + Vera)', () => {
    const livePublicBundle = { '.open-next/assets/a.js': `x("${FAKE.pk}","${FAKE.anonJwt}","${FAKE.liveUrl}")` }
    const PUBLIC_CHECKS = [
      'stripe-live-publishable-key (pk_live_) @ bundle:.open-next/assets/a.js',
      'supabase-live-project-jwt (anon) @ bundle:.open-next/assets/a.js',
      'supabase-live-project-ref @ bundle:.open-next/assets/a.js',
    ]

    it('preview + flag + live public markers = refuse (the flag is rejected and the markers still count)', () => {
      const root = project(livePublicBundle)
      const r = runGuard({ root, env: DUMMY_ENV, target: 'preview', allowLivePublicArg: true })
      expect(r.livePublicRelaxed).toBe(false)
      expect(checks(r)).toEqual(['override-only-for-production (preview never accepts live public markers) @ target:preview', ...PUBLIC_CHECKS])
    })

    it('production + no flag + live public markers = refuse', () => {
      const root = project(livePublicBundle)
      expect(checks(runGuard({ root, env: DUMMY_ENV, target: 'production' }))).toEqual(PUBLIC_CHECKS)
    })

    it('production + flag on the command + public markers only = pass', () => {
      const root = project(livePublicBundle)
      const r = runGuard({ root, env: { ...DUMMY_ENV, NEXT_PUBLIC_SUPABASE_URL: FAKE.liveUrl, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: FAKE.pk }, target: 'production', allowLivePublicArg: true })
      expect(checks(r)).toEqual([])
      expect(r.livePublicRelaxed).toBe(true)
    })

    it('production + flag + a secret marker = refuse (secrets are never relaxed)', () => {
      const root = project({ ...livePublicBundle, '.open-next/worker.js': `const k="${FAKE.sk}";const s="${FAKE.serviceJwt}";const w="${FAKE.whsec}"` })
      expect(checks(runGuard({ root, env: { ...DUMMY_ENV, SMTP_PASS: FAKE.smtp }, target: 'production', allowLivePublicArg: true }))).toEqual([
        'smtp-pass-set-to-real-value @ env:SMTP_PASS',
        'stripe-live-secret-key (sk_live_/rk_live_) @ bundle:.open-next/worker.js',
        'supabase-service-role-jwt (live project) @ bundle:.open-next/worker.js',
        'stripe-webhook-secret-in-bundle @ bundle:.open-next/worker.js',
      ])
    })

    it('flag in a .env file = refuse, even for production with the argument', () => {
      const root = project({ ...livePublicBundle, '.env.production': 'FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes\n' })
      expect(checks(runGuard({ root, env: DUMMY_ENV, target: 'production', allowLivePublicArg: true }))).toEqual([
        'override-flag-in-file (set it on the command only: npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes) @ .env.production:FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC',
      ])
    })

    it('flag in .dev.vars or wrangler vars = refuse', () => {
      const root = project({
        '.dev.vars': 'FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes\n',
        'wrangler.jsonc': '{ "vars": { "FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC": "yes" } }',
      })
      expect(checks(runGuard({ root, env: DUMMY_ENV, target: 'production', allowLivePublicArg: true })).map((c) => c.split(' @ ')[1])).toEqual([
        '.dev.vars:FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC',
        'wrangler.jsonc:vars:FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC',
      ])
    })

    it('flag in the process env (exported, or inline: a child cannot tell them apart) = refuse, any value', () => {
      const root = project(livePublicBundle)
      for (const v of ['yes', 'no', '']) {
        const out = checks(runGuard({ root, env: { ...DUMMY_ENV, FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC: v }, target: 'production', allowLivePublicArg: true }))
        expect(out).toEqual([
          'override-flag-in-environment (set it on the command only: npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes) @ env:FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC',
        ])
      }
      // and the env var alone never relaxes anything
      expect(checks(runGuard({ root, env: { ...DUMMY_ENV, FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC: 'yes' }, target: 'production' }))).toEqual(
        expect.arrayContaining(PUBLIC_CHECKS)
      )
    })

    it('production refuses when CLOUDFLARE_ENV could retarget wrangler; unknown targets refuse', () => {
      const root = project({ '.env': 'CLOUDFLARE_ENV=preview\n' })
      expect(checks(runGuard({ root, env: { ...DUMMY_ENV, CLOUDFLARE_ENV: 'preview' }, target: 'production' }))).toEqual([
        'cloudflare-env-set-on-production-upload (unset CLOUDFLARE_ENV) @ env:CLOUDFLARE_ENV',
        'cloudflare-env-set-on-production-upload (unset CLOUDFLARE_ENV) @ .env:CLOUDFLARE_ENV',
      ])
      expect(checks(runGuard({ root: project({}), env: DUMMY_ENV, target: 'staging' as 'preview' }))).toEqual(['unknown-upload-target @ target:staging'])
    })

    it('CLI: argument form works for production only; default target is preview', () => {
      const guard = path.join(__dirname, 'cf-upload-guard.mjs')
      const env = { NODE_ENV: 'test' as const, PATH: process.env.PATH ?? '' }
      const root = project(livePublicBundle)
      const prod = spawnSync(process.execPath, [guard, '--target=production', 'FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes', root], { env, encoding: 'utf8' })
      expect(prod.status).toBe(0)
      expect(prod.stdout).toContain('Live PUBLIC markers allowed for this production upload only')
      const prev = spawnSync(process.execPath, [guard, 'FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes', root], { env, encoding: 'utf8' })
      expect(prev.status).toBe(1)
      expect(prev.stderr).toContain('REFUSED (preview)')
      const odd = spawnSync(process.execPath, [guard, '--env=preview', root], { env, encoding: 'utf8' })
      expect(odd.status).toBe(2)
      for (const r of [prod, prev, odd]) for (const v of Object.values(FAKE)) expect(r.stdout + r.stderr).not.toContain(v)
    })

    it('cf:upload:production refuses BEFORE building when the flag is in the env, or on any other argument', () => {
      const runner = path.join(__dirname, 'cf-upload-production.mjs')
      // PATH without node_modules/.bin: if it ever got as far as building it would fail differently.
      const env = { NODE_ENV: 'test' as const, PATH: path.dirname(process.execPath), FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC: 'yes' }
      const r = spawnSync(process.execPath, [runner, 'FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes'], { env, encoding: 'utf8' })
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('override-flag-in-environment (set it on the command only')
      expect(r.stderr).not.toMatch(/could not run|opennextjs-cloudflare/)
      const extra = spawnSync(process.execPath, [runner, '--env', 'preview'], { env: { ...env, FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC: undefined }, encoding: 'utf8' })
      expect(extra.status).toBe(2)
      expect(extra.stderr).toContain('unknown argument(s): --env, preview')
    })
  })

  it('CLI exits 1 and prints which check tripped, never a value', () => {
    const root = project({ '.dev.vars': `SMTP_PASS=${FAKE.smtp}\n`, '.open-next/worker.js': `"${FAKE.serviceJwt}"` })
    const env = { NODE_ENV: 'test' as const, PATH: process.env.PATH ?? '', STRIPE_SECRET_KEY: FAKE.sk, RESEND_API_KEY: FAKE.resend, NEXT_PUBLIC_SUPABASE_URL: FAKE.liveUrl }
    const r = spawnSync(process.execPath, [path.join(__dirname, 'cf-upload-guard.mjs'), root], { env, encoding: 'utf8' })
    const output = r.stdout + r.stderr
    expect(r.status).toBe(1)
    expect(output).toContain('upload guard: REFUSED')
    expect(output).toContain('stripe-live-secret-key (sk_live_/rk_live_)  @ env:STRIPE_SECRET_KEY')
    expect(output).toContain('smtp-pass-set-to-real-value  @ .dev.vars:SMTP_PASS')
    for (const v of Object.values(FAKE)) expect(output).not.toContain(v)
    expect(output).not.toMatch(/sk_live_[A-Za-z0-9]|eyJ|re_FAKE|Tr0ub4dor/)
    const clean = spawnSync(process.execPath, [path.join(__dirname, 'cf-upload-guard.mjs'), project({})], { env: { NODE_ENV: 'test', PATH: env.PATH }, encoding: 'utf8' })
    expect(clean.status).toBe(0)
  })

  it('package.json: preview and production uploads are separate, explicit scripts; nothing deploys', async () => {
    const { scripts } = (await import('../package.json')).default as { scripts: Record<string, string> }
    expect(scripts['upload:preview']).toBe('opennextjs-cloudflare build && node scripts/cf-upload-guard.mjs --target=preview && wrangler versions upload --env preview')
    expect(scripts['cf:upload:production']).toBe('node scripts/cf-upload-production.mjs')
    expect(scripts.upload).toMatch(/^echo 'Refused: pick a target.*exit 1$/)
    expect(scripts.deploy).toMatch(/exit 1$/)
    expect(Object.values(scripts).join('\n')).not.toMatch(/FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC/)
    expect(Object.values(scripts).join('\n')).not.toMatch(/wrangler deploy|versions deploy(?! <id>)/)
    const runner = readFileSync(path.join(__dirname, 'cf-upload-production.mjs'), 'utf8')
    // The only commands it spawns: the build, then `wrangler versions upload` with no --env (top-level = production).
    expect([...runner.matchAll(/run\('([^']+)', \[([^\]]*)\]/g)].map((m) => `${m[1]} ${m[2]}`)).toEqual([
      "opennextjs-cloudflare 'build'",
      "wrangler 'versions', 'upload'",
    ])
  })
})
