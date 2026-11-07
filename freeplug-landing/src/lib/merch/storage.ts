import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

export const MERCH_BUNDLE_OBJECT_KEY = 'freeplug-font-bundle-v1.zip'
/** Limited personal-use demo (subset); never the paid bundle. */
export const MERCH_PERSONAL_DEMO_OBJECT_KEY = 'merch/freeplug-fonts-personal-demo.zip'
export const MERCH_PERSONAL_DEMO_FILENAME = 'freeplug-fonts-personal-demo.zip'

const DEV_BUNDLE_DIR = '.merch-dev-only'

type R2Bucket = {
  get: (key: string) => Promise<{ body: ReadableStream | null } | null>
}

export type MerchBundleSource = 'local' | 'r2' | 'mock'

export function resolveLocalBundlePath(env: Record<string, string | undefined> = process.env): string | null {
  const fromEnv = env.MERCH_BUNDLE_LOCAL_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const devPath = path.join(process.cwd(), DEV_BUNDLE_DIR, MERCH_BUNDLE_OBJECT_KEY)
  if (existsSync(devPath)) return devPath
  return null
}

export function merchBundleSource(env: Record<string, string | undefined> = process.env): MerchBundleSource {
  if (resolveLocalBundlePath(env)) return 'local'
  return env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true' ? 'mock' : 'r2'
}

/** Node runtime: stream from local disk or in-memory mock bytes. */
export async function readMerchBundleBytes(env: Record<string, string | undefined> = process.env): Promise<Buffer> {
  const local = resolveLocalBundlePath(env)
  if (local) return readFile(/* turbopackIgnore: true */ local)
  if (isMerchMockBundle(env)) {
    return Buffer.from('Freeplug Font Bundle (mock archive for preview only)\n', 'utf8')
  }
  throw new Error('Merch bundle file is not available on this host')
}

export function isMerchMockBundle(env: Record<string, string | undefined> = process.env): boolean {
  return !resolveLocalBundlePath(env) && env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true'
}

/** Workers / R2 path when MERCH_PRIVATE binding is present (cloudflare-env). */
export async function streamMerchBundleFromR2(
  bucket: R2Bucket | undefined,
  env: Record<string, string | undefined> = process.env
): Promise<ReadableStream | NodeJS.ReadableStream> {
  const local = resolveLocalBundlePath(env)
  if (local) return createReadStream(local)
  if (!bucket) throw new Error('MERCH_PRIVATE R2 binding is not configured')
  const obj = await bucket.get(MERCH_BUNDLE_OBJECT_KEY)
  if (!obj?.body) throw new Error('Merch bundle object missing in private storage')
  return obj.body as ReadableStream
}

export function merchDownloadFilename(): string {
  return MERCH_BUNDLE_OBJECT_KEY
}

export function resolveLocalPersonalDemoPath(env: Record<string, string | undefined> = process.env): string | null {
  const fromEnv = env.MERCH_PERSONAL_DEMO_LOCAL_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const devPath = path.join(process.cwd(), DEV_BUNDLE_DIR, MERCH_PERSONAL_DEMO_FILENAME)
  if (existsSync(devPath)) return devPath
  return null
}

export async function readMerchPersonalDemoBytes(env: Record<string, string | undefined> = process.env): Promise<Buffer> {
  const local = resolveLocalPersonalDemoPath(env)
  if (local) return readFile(/* turbopackIgnore: true */ local)
  if (isMerchPersonalDemoMock(env)) {
    return Buffer.from('Freeplug personal-use font demo (mock — limited subset placeholder)\n', 'utf8')
  }
  throw new Error('Personal demo zip is not available on this host')
}

export function isMerchPersonalDemoMock(env: Record<string, string | undefined> = process.env): boolean {
  return (
    !resolveLocalPersonalDemoPath(env) &&
    (env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true' ||
      env.MERCH_PERSONAL_DOWNLOAD_ENABLED?.trim().toLowerCase() === 'true')
  )
}
