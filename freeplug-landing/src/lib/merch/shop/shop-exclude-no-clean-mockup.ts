import noCleanDoc from '@/lib/merch/shop/shop-no-clean-mockup.json'

type NoCleanFile = {
  slugs: string[]
  slugReasons?: Record<string, string>
  ownerNoVisibleMark?: string[]
}

const doc = noCleanDoc as NoCleanFile

/** Slugs with no clean Printify blank (see shop-no-clean-mockup.json). */
export function shopNoCleanMockupSlugs(): ReadonlySet<string> {
  return new Set(doc.slugs)
}

/**
 * When true, buyer shop grid omits `shop-no-clean-mockup.json` slugs.
 * Default **on**; set `SHOP_EXCLUDE_NO_CLEAN_MOCKUP=false` to show them.
 */
export function isShopExcludeNoCleanMockupEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const v = env.SHOP_EXCLUDE_NO_CLEAN_MOCKUP?.trim().toLowerCase()
  if (v === 'false') return false
  return true
}

export function shopNoCleanMockupReasons(): Readonly<Record<string, string>> {
  const reasons = (doc as NoCleanFile).slugReasons
  return reasons ?? {}
}
