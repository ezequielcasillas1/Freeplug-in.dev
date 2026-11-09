import type { MerchCatalogEntry } from './catalog'

const SIZE_TOKENS =
  /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|(\d+)(XL|T|M))$|^\d+["']?$|^\d+-\d+M$|^\d+oz$/i

function normalizeInches(text: string): string {
  return text
    .replace(/''/g, '″')
    .replace(/"/g, '″')
    .replace(/\s+/g, ' ')
    .trim()
}

export type SplitOptionPlan = {
  dim1Kind: 'style' | 'color' | 'size' | 'model'
  dim2Kind: 'size' | 'color' | 'fit'
  dim1Values: string[]
  dim2Values: string[]
  pairs: Map<string, string>
  formatDim1: (v: string) => string
  formatDim2: (v: string) => string
}

function splitLabel(label: string): [string, string] | null {
  const i = label.indexOf(' / ')
  if (i < 0) return null
  return [label.slice(0, i).trim(), label.slice(i + 3).trim()]
}

function looksLikeSize(token: string): boolean {
  const t = token.trim()
  if (SIZE_TOKENS.test(t)) return true
  if (/^\d+(\.\d+)?\s*″/.test(t)) return true
  if (/×/.test(t) && /\d/.test(t)) return true
  if (/^(Regular Can|Slim Can|One [Ss]ize|One size|Circle|16oz|12oz|Lined|Rectangle)/i.test(t)) return true
  if (/iPhone|iPad|Galaxy|Pixel/i.test(token)) return true
  return false
}

function classifyDim1(left: string): SplitOptionPlan['dim1Kind'] {
  if (left === 'Artwork' || left === 'Photo') return 'style'
  if (looksLikeSize(left)) return 'size'
  return 'color'
}

export function planSplitOptions(entry: MerchCatalogEntry): SplitOptionPlan | null {
  if (entry.slug === 'hero-crewneck' || entry.options.length <= 1) return null

  const parsed: { key: string; left: string; right: string }[] = []
  for (const o of entry.options) {
    const label = o.label ?? o.key
    const parts = splitLabel(label)
    if (!parts) return null
    parsed.push({ key: o.key, left: parts[0], right: parts[1] })
  }

  const dim1Values = [...new Set(parsed.map((p) => p.left))]
  const dim2Values = [...new Set(parsed.map((p) => p.right))]
  if (dim1Values.length < 2 && dim2Values.length < 2) return null

  let dim1Kind = classifyDim1(parsed[0]!.left)
  let dim2Kind: SplitOptionPlan['dim2Kind'] = looksLikeSize(parsed[0]!.right) ? 'size' : 'color'

  if (dim1Kind === 'size') {
    dim1Kind = 'color'
    dim2Kind = 'size'
    for (const p of parsed) {
      const swap = p.left
      p.left = p.right
      p.right = swap
    }
  } else if (dim1Kind === 'color' && dim2Values.every((v) => looksLikeSize(v))) {
    dim2Kind = 'size'
  } else if (dim1Kind === 'style') {
    dim2Kind = 'size'
  } else if (dim1Kind === 'color' && !dim2Values.some((v) => looksLikeSize(v))) {
    dim2Kind = 'fit'
  }

  const dim1Set = [...new Set(parsed.map((p) => p.left))]
  const dim2Set = [...new Set(parsed.map((p) => p.right))]

  const pairs = new Map<string, string>()
  for (const p of parsed) {
    pairs.set(`${p.left}\0${p.right}`, p.key)
  }

  const formatDim1 = (v: string) => (dim1Kind === 'style' ? v : dim1Kind === 'color' ? v : normalizeInches(v))
  const formatDim2 = (v: string) => normalizeInches(v)

  return {
    dim1Kind,
    dim2Kind,
    dim1Values: dim1Set,
    dim2Values: dim2Set,
    pairs,
    formatDim1,
    formatDim2,
  }
}

export function resolveSplitOptionKey(plan: SplitOptionPlan, dim1: string, dim2: string): string | null {
  return plan.pairs.get(`${dim1}\0${dim2}`) ?? null
}

export function defaultSplitSelection(plan: SplitOptionPlan): { dim1: string; dim2: string } {
  const dim1 = plan.dim1Values[0]!
  for (const dim2 of plan.dim2Values) {
    if (plan.pairs.has(`${dim1}\0${dim2}`)) return { dim1, dim2 }
  }
  const firstKey = plan.pairs.keys().next().value as string
  const [a, b] = firstKey.split('\0')
  return { dim1: a!, dim2: b! }
}
