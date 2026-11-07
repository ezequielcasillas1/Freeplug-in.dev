import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createAdminClient } from '@/lib/supabase/admin'

export const MERCH_BUNDLE_OBJECT_KEY = 'freeplug-font-bundle-v1.zip'
/** Limited personal-use demo (subset); never the paid bundle. */
export const MERCH_PERSONAL_DEMO_OBJECT_KEY = 'freeplug-fonts-personal-demo.zip'
/** Private Supabase Storage bucket (public=false). Only the service-role client can read it. */
export const MERCH_STORAGE_BUCKET = 'merch-private'
export const MERCH_PERSONAL_DEMO_FILENAME = 'freeplug-fonts-personal-demo.zip'

const DEV_BUNDLE_DIR = '.merch-dev-only'

export type MerchBundleSource = 'local' | 'storage' | 'mock'

type StorageDownloader = (bucket: string, key: string) => Promise<Buffer | null>

/** Downloads a private object with the service-role client. Callers validate our token / rate limit first. */
export const downloadPrivateObject: StorageDownloader = async (bucket, key) => {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(bucket).download(key)
  if (error || !data) {
    console.error('[merch/storage] download failed', bucket, key, error?.message)
    return null
  }
  return Buffer.from(await data.arrayBuffer())
}

export function resolveLocalBundlePath(env: Record<string, string | undefined> = process.env): string | null {
  const fromEnv = env.MERCH_BUNDLE_LOCAL_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const devPath = path.join(process.cwd(), DEV_BUNDLE_DIR, MERCH_BUNDLE_OBJECT_KEY)
  if (existsSync(devPath)) return devPath
  return null
}

export function merchBundleSource(env: Record<string, string | undefined> = process.env): MerchBundleSource {
  if (resolveLocalBundlePath(env)) return 'local'
  return env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true' ? 'mock' : 'storage'
}

/** Node runtime: stream from local disk or in-memory mock bytes. */
export async function readMerchBundleBytes(
  env: Record<string, string | undefined> = process.env,
  download: StorageDownloader = downloadPrivateObject
): Promise<Buffer> {
  const local = resolveLocalBundlePath(env)
  if (local) return readFile(/* turbopackIgnore: true */ local)
  if (isMerchMockBundle(env)) {
    return Buffer.from('Freeplug Font Bundle (mock archive for preview only)\n', 'utf8')
  }
  const fromStorage = await download(MERCH_STORAGE_BUCKET, MERCH_BUNDLE_OBJECT_KEY)
  if (fromStorage) return fromStorage
  throw new Error('Merch bundle file is not available on this host')
}

export function isMerchMockBundle(env: Record<string, string | undefined> = process.env): boolean {
  return !resolveLocalBundlePath(env) && env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true'
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

export async function readMerchPersonalDemoBytes(
  env: Record<string, string | undefined> = process.env,
  download: StorageDownloader = downloadPrivateObject
): Promise<Buffer> {
  const local = resolveLocalPersonalDemoPath(env)
  if (local) return readFile(/* turbopackIgnore: true */ local)
  if (isMerchPersonalDemoMock(env)) {
    return Buffer.from('Freeplug personal-use font demo (mock — limited subset placeholder)\n', 'utf8')
  }
  const fromStorage = await download(MERCH_STORAGE_BUCKET, MERCH_PERSONAL_DEMO_OBJECT_KEY)
  if (fromStorage) return fromStorage
  if (isMerchPersonalDemoMock(env)) {
    return Buffer.from('Freeplug personal-use font demo (mock — limited subset placeholder)\n', 'utf8')
  }
  throw new Error('Personal demo zip is not available on this host')
}

export function isMerchPersonalDemoMock(env: Record<string, string | undefined> = process.env): boolean {
  if (resolveLocalPersonalDemoPath(env)) return false
  return (
    env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true' &&
    !env.MERCH_PERSONAL_DEMO_LOCAL_PATH?.trim()
  )
}
