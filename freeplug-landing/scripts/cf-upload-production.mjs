#!/usr/bin/env node
/**
 * PRODUCTION upload (Cloudflare port, Oct 3): `npm run cf:upload:production [-- FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes]`.
 * Runs only after Ezequiel's yes. It uploads a version; it never deploys (promoting is `wrangler versions deploy <id>`,
 * Gate 1).
 *   1. Pre-flight guard (target production, no bundle yet): refuses before building if the override flag is in
 *      any variable/env file, CLOUDFLARE_ENV is set, or live secrets are around.
 *   2. opennextjs-cloudflare build, then populateCache local (copies prerendered pages into the static assets)
 *   3. Full guard on the built bundle (target production; live PUBLIC markers relaxed only with the argument).
 *   4. wrangler versions upload, with no --env: the top-level `freeplug` Worker in wrangler.jsonc is production.
 *      CLOUDFLARE_ENV is removed from its env.
 * The only accepted argument is FREEPLUG_UPLOAD_ALLOW_LIVE_PUBLIC=yes; anything else (e.g. --env preview) is refused.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OVERRIDE_ARG, report, runGuard } from './cf-upload-guard.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const unknown = argv.filter((a) => a !== OVERRIDE_ARG)
if (unknown.length) {
  console.error(`cf:upload:production: REFUSED, unknown argument(s): ${unknown.map((a) => a.split('=')[0]).join(', ')}. Only ${OVERRIDE_ARG} is accepted.`)
  process.exit(2)
}
const allowLivePublicArg = argv.includes(OVERRIDE_ARG)
const guard = (scanBundle) => runGuard({ root, target: 'production', allowLivePublicArg, scanBundle })

if (report(guard(false)) !== 0) process.exit(1)
const run = (cmd, args, env = process.env) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env })
  if (r.error) console.error(`cf:upload:production: could not run ${cmd}`)
  return r.status ?? 1
}
if (run('opennextjs-cloudflare', ['build']) !== 0) process.exit(1)
// Copy the prerendered pages (.open-next/cache) into assets/cdn-cgi/_next_cache for the static-assets
// incremental cache. `wrangler versions upload` skips this (only `opennextjs-cloudflare deploy/upload` do it);
// without it every prerendered [locale] page ('/', '/es', '/faq') is a cache miss -> 404 (dynamicParams = false).
// Local file copy only: no remote writes.
if (run('opennextjs-cloudflare', ['populateCache', 'local']) !== 0) process.exit(1)
if (report(guard(true)) !== 0) process.exit(1)
const env = { ...process.env }
delete env.CLOUDFLARE_ENV
process.exit(run('wrangler', ['versions', 'upload'], env))
