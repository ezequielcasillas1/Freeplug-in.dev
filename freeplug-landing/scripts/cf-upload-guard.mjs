#!/usr/bin/env node
/**
 * Upload guard (Jace, Oct 3). `npm run upload` / `upload:preview` run this between
 * `opennextjs-cloudflare build` and `wrangler versions upload`; any finding stops the upload.
 *
 * Looks for live credentials in four places:
 *   env       the shell environment of the build/upload (what `next build` baked in)
 *   .env*     .env, .env.local, .env.production, .env.production.local (next build reads them)
 *   .dev.vars local Worker vars (never uploaded, but must stay dummy)
 *   vars      wrangler.jsonc "vars", top level and every env.<name>.vars
 *   bundle    every file under .open-next/ (Worker code and static assets)
 *
 * It prints only the check name and where it fired (source + variable name or file path),
 * NEVER the value. Exit 1 on any finding, 0 when clean.
 *
 * Live markers: sk_live_ / rk_live_ / pk_live_ keys, the live Supabase project ref, a
 * service_role JWT, RESEND_API_KEY or SMTP_PASS set to a real (non-placeholder) value, a
 * whsec_ next to a live Stripe key (a whsec_ alone does not say test or live mode), secrets in
 * plain wrangler vars, and any secret value from the env showing up in the bundle.
 *
 * Targets: --target=preview (default, strictest) or --target=production.
 *
 * Production override (Jace + Vera, Oct 3): the argument FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes relaxes ONLY the
 * public markers (pk_live_, the live project ref, the live anon JWT), which a real production build has to
 * contain. It works only when the target is production (npm run cf:upload:production -- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes,
 * see cf-upload-production.mjs). Secret markers are never relaxed. A preview upload always refuses live
 * public markers, with or without the argument.
 * Why an argument and not an env var: a child process can't tell `VAR=yes cmd` from an exported VAR, so it
 * can't reliably tell "on this one command" from "left in the shell". An argument can't be inherited. So the
 * variable is refused wherever it appears as a variable (the process env, .env*, .dev.vars, wrangler vars),
 * with a message to pass it on the command instead.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LIVE_SUPABASE_REF = 'ldlyjoybppmwvvcarewq'
export const OVERRIDE_FLAG = 'FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC'
export const OVERRIDE_ARG = `${OVERRIDE_FLAG}=yes`
export const TARGETS = ['preview', 'production']
const ON_COMMAND_ONLY = `set it on the command only: npm run cf:upload:production -- ${OVERRIDE_ARG}`
export const SECRET_VAR_NAMES = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_PASSWORD',
  'RESEND_API_KEY',
  'SMTP_PASS',
  'TURNSTILE_SECRET_KEY',
]
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local']

const RE = {
  stripeSecret: /\b(?:sk|rk)_live_[A-Za-z0-9]{8,}/,
  stripePublishable: /\bpk_live_[A-Za-z0-9]{8,}/,
  whsec: /\bwhsec_[A-Za-z0-9+/=]{16,}/,
  jwt: /\beyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g,
  resendKey: /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{12,}/,
}
const PLACEHOLDER = /dummy|placeholder|example|changeme|your[-_]|local[-_]only|not[-_]a[-_]real|^x+$|^re_x+$|^\*+$|^\.\.\.$/i

function isRealValue(v) {
  return typeof v === 'string' && v.trim() !== '' && !PLACEHOLDER.test(v.trim())
}

function jwtClaims(text) {
  const out = []
  for (const m of text.matchAll(RE.jwt)) {
    try {
      out.push(JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')))
    } catch {
      /* not a JWT */
    }
  }
  return out
}

/** Checks one text blob. `kind` is 'vars' (KEY -> value map) or 'blob' (a file in the bundle). */
function scanText(text, where, { allowLivePublic }) {
  const hits = []
  const add = (check, publicOnly = false) => {
    if (!(publicOnly && allowLivePublic)) hits.push({ check, where })
  }
  if (RE.stripeSecret.test(text)) add('stripe-live-secret-key (sk_live_/rk_live_)')
  if (RE.stripePublishable.test(text)) add('stripe-live-publishable-key (pk_live_)', true)
  for (const c of jwtClaims(text)) {
    if (c && c.role === 'service_role') add(`supabase-service-role-jwt${c.ref === LIVE_SUPABASE_REF ? ' (live project)' : ''}`)
    else if (c && c.ref === LIVE_SUPABASE_REF) add('supabase-live-project-jwt (anon)', true)
  }
  if (text.includes(LIVE_SUPABASE_REF)) add('supabase-live-project-ref', true)
  return hits
}

function scanVars(vars, source, opts) {
  const hits = []
  const all = Object.entries(vars).filter(([, v]) => typeof v === 'string')
  for (const [k, v] of all) {
    for (const h of scanText(v, `${source}:${k}`, opts)) hits.push(h)
  }
  for (const k of ['RESEND_API_KEY', 'SMTP_PASS']) {
    if (isRealValue(vars[k])) hits.push({ check: `${k.toLowerCase().replace(/_/g, '-')}-set-to-real-value`, where: `${source}:${k}` })
  }
  const liveStripe = all.some(([, v]) => RE.stripeSecret.test(v) || RE.stripePublishable.test(v))
  for (const [k, v] of all) {
    if (liveStripe && /^whsec_/.test(v.trim())) hits.push({ check: 'stripe-webhook-secret-next-to-live-key (likely live mode)', where: `${source}:${k}` })
  }
  if (opts.plainVars) {
    for (const k of SECRET_VAR_NAMES) {
      if (k in vars) hits.push({ check: 'secret-in-plain-wrangler-vars (use versions secret put)', where: `${source}:${k}` })
    }
  }
  return hits
}

export function parseDotenv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1)
    else v = v.replace(/\s+#.*$/, '')
    out[m[1]] = v
  }
  return out
}

/** JSONC: drop // and /* *\/ comments outside strings, then trailing commas. */
export function parseJsonc(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1
      if (i === 0) break
    } else out += c
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

function* walkFiles(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) yield* walkFiles(p)
    else if (d.isFile()) yield p
  }
}

/**
 * @param {{ root: string, env?: Record<string, string | undefined>, bundleDir?: string,
 *   target?: 'preview' | 'production', allowLivePublicArg?: boolean, scanBundle?: boolean }} options
 * @returns {{ scanned: number, target: string, livePublicRelaxed: boolean, findings: { check: string, where: string }[] }}
 */
export function runGuard({
  root,
  env = process.env,
  bundleDir = path.join(root, '.open-next'),
  target = 'preview',
  allowLivePublicArg = false,
  scanBundle = true,
}) {
  const findings = []
  const push = (hs) => findings.push(...hs)
  if (!TARGETS.includes(target)) findings.push({ check: 'unknown-upload-target', where: `target:${String(target)}` })

  // The override flag must never live in a variable: process env (exported or inline: indistinguishable), env files, vars.
  if (env[OVERRIDE_FLAG] !== undefined) findings.push({ check: `override-flag-in-environment (${ON_COMMAND_ONLY})`, where: `env:${OVERRIDE_FLAG}` })
  if (allowLivePublicArg && target !== 'production') {
    findings.push({ check: 'override-only-for-production (preview never accepts live public markers)', where: `target:${target}` })
  }
  const livePublicRelaxed = allowLivePublicArg && target === 'production'
  const opts = { allowLivePublic: livePublicRelaxed }

  push(scanVars(env, 'env', opts))
  const fileVars = []
  for (const f of [...ENV_FILES, '.dev.vars']) {
    const p = path.join(root, f)
    if (existsSync(p)) fileVars.push([f, parseDotenv(readFileSync(p, 'utf8'))])
  }
  const wranglerPath = path.join(root, 'wrangler.jsonc')
  if (existsSync(wranglerPath)) {
    const cfg = parseJsonc(readFileSync(wranglerPath, 'utf8'))
    fileVars.push(['wrangler.jsonc:vars', cfg.vars ?? {}, true])
    for (const [name, e] of Object.entries(cfg.env ?? {})) fileVars.push([`wrangler.jsonc:env.${name}.vars`, e?.vars ?? {}, true])
  }
  for (const [source, vars, plainVars] of fileVars) {
    if (OVERRIDE_FLAG in vars) findings.push({ check: `override-flag-in-file (${ON_COMMAND_ONLY})`, where: `${source}:${OVERRIDE_FLAG}` })
    push(scanVars(vars, source, { ...opts, plainVars: Boolean(plainVars) }))
  }

  // Production uploads run `wrangler versions upload` with no --env (the top-level `freeplug` Worker). Wrangler
  // also picks an environment from CLOUDFLARE_ENV (shell or .env), which would silently retarget it.
  if (target === 'production') {
    if (env.CLOUDFLARE_ENV) findings.push({ check: 'cloudflare-env-set-on-production-upload (unset CLOUDFLARE_ENV)', where: 'env:CLOUDFLARE_ENV' })
    for (const [source, vars] of fileVars) {
      if (vars.CLOUDFLARE_ENV) findings.push({ check: 'cloudflare-env-set-on-production-upload (unset CLOUDFLARE_ENV)', where: `${source}:CLOUDFLARE_ENV` })
    }
  }

  let scanned = 0
  if (scanBundle && !existsSync(bundleDir)) {
    findings.push({ check: 'bundle-missing (run opennextjs-cloudflare build first)', where: path.relative(root, bundleDir) })
  } else if (scanBundle) {
    const envSecrets = SECRET_VAR_NAMES.map((k) => [k, env[k]]).filter(([, v]) => typeof v === 'string' && v.length >= 8 && isRealValue(v))
    for (const file of walkFiles(bundleDir)) {
      if (statSync(file).size > 64 * 1024 * 1024) continue
      const text = readFileSync(file, 'latin1')
      scanned++
      const rel = path.relative(root, file)
      push(scanText(text, `bundle:${rel}`, opts))
      if (RE.whsec.test(text)) findings.push({ check: 'stripe-webhook-secret-in-bundle', where: `bundle:${rel}` })
      if (RE.resendKey.test(text)) findings.push({ check: 'resend-api-key-in-bundle', where: `bundle:${rel}` })
      for (const [k, v] of envSecrets) {
        if (text.includes(v)) findings.push({ check: `env-secret-value-in-bundle (${k})`, where: `bundle:${rel}` })
      }
    }
  }
  // One line per (check, where).
  const seen = new Set()
  return {
    scanned,
    target,
    livePublicRelaxed,
    findings: findings.filter((f) => {
      const key = `${f.check}|${f.where}`
      return seen.has(key) ? false : (seen.add(key), true)
    }),
  }
}

/** Prints findings (check + where, never values). Returns the exit code. */
export function report({ scanned, target, livePublicRelaxed, findings }, log = console) {
  if (findings.length) {
    log.error(`upload guard: REFUSED (${target}), ${findings.length} finding(s) (values not shown):`)
    for (const f of findings) log.error(`  x ${f.check}  @ ${f.where}`)
    log.error('Nothing was uploaded.')
    return 1
  }
  const relaxed = livePublicRelaxed ? ' Live PUBLIC markers allowed for this production upload only (secret markers still checked).' : ''
  log.log(`upload guard: OK (${target}; env, .env*, .dev.vars, wrangler vars, ${scanned} bundle files: no live credentials).${relaxed}`)
  return 0
}

/** CLI args: [--target=preview|production] [FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes] [projectRoot]. */
export function parseArgs(argv, defaultRoot) {
  let target = 'preview'
  let allowLivePublicArg = false
  let root = defaultRoot
  const bad = []
  for (const a of argv) {
    if (a.startsWith('--target=')) target = a.slice('--target='.length)
    else if (a === OVERRIDE_ARG) allowLivePublicArg = true
    else if (a.startsWith('-') || a.includes('=')) bad.push(a.split('=')[0])
    else root = path.resolve(a)
  }
  return { target, allowLivePublicArg, root, bad }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = parseArgs(process.argv.slice(2), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
  if (args.bad.length) {
    console.error(`upload guard: REFUSED, unknown argument(s): ${args.bad.join(', ')}`)
    process.exit(2)
  }
  process.exit(report(runGuard(args)))
}
