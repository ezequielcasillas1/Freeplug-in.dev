import en from '../../messages/en.json'
import es from '../../messages/es.json'
import esStatus from '../../messages/es.status.json'
import type { AppLocale } from './config'
import { allowPendingSpanish, markPendingSpanish } from './gate'

/**
 * Message catalogs (card §5 C1: en.json is the English lock now).
 * - messages/en.json: Sable's re-extraction at ea817ef (/workspace/copy/freeplug-en-source-2026-10-04.json)
 *   plus the keys Owen added for the build (listed in messages/pending-sable.json, English only).
 * - messages/es.json: Sable's DRAFT (/workspace/copy/freeplug-es-draft-2026-10-04.json). She is
 *   still revising it, and the 425 [STRICT] lines need a native speaker's sign-off (card §9).
 * - messages/es.status.json: "draft" until that sign-off. Spanish is served only when it is
 *   "reviewed" AND complete, or with the local-QA override.
 */
export type Messages = typeof en
type Tree = { [key: string]: string | Tree }

/**
 * Sable's catalogs write a line break as `<br/>`. ICU (use-intl) has no self-closing tags and would
 * print it literally ("Free websites for<br/>..." on the hero), so the loader rewrites it to the
 * equivalent `<br></br>` tag pair. The files in messages/ stay byte-for-byte Sable's.
 */
export function normalizeMarkup<T>(tree: T): T {
  if (typeof tree === 'string') return tree.replace(/<br\s*\/>/g, '<br></br>') as T
  if (tree && typeof tree === 'object')
    return Object.fromEntries(Object.entries(tree as Record<string, unknown>).map(([k, v]) => [k, normalizeMarkup(v)])) as T
  return tree
}

export const EN_MESSAGES: Messages = normalizeMarkup(en)
export const ES_MESSAGES: Tree = normalizeMarkup(es as Tree)

export function flattenMessages(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, flattenMessages(v, key))
  }
  return out
}

/** Keys in `base` that `other` does not have (sorted). */
export function missingKeys(base: Tree, other: Tree): string[] {
  const o = flattenMessages(other)
  return Object.keys(flattenMessages(base)).filter((k) => !(k in o)).sort()
}

/** Keys in `other` that `base` does not have (sorted). */
export function extraKeys(base: Tree, other: Tree): string[] {
  const b = flattenMessages(base)
  return Object.keys(flattenMessages(other)).filter((k) => !(k in b)).sort()
}

export const PENDING_PREFIX = '[pending Sable] '

function fillFrom(base: Tree, over: Tree, mark: boolean): Tree {
  const out: Tree = {}
  for (const [k, v] of Object.entries(base)) {
    const o = over[k]
    if (typeof v === 'string') out[k] = typeof o === 'string' ? o : mark ? PENDING_PREFIX + v : v
    else out[k] = fillFrom(v, o && typeof o === 'object' ? o : {}, mark)
  }
  return out
}

export type SpanishStatus = { status: 'draft' | 'reviewed'; source?: string; note?: string }
export const ES_STATUS = esStatus as SpanishStatus

export class SpanishPendingError extends Error {
  constructor(
    public readonly missing: string[],
    public readonly status: SpanishStatus['status']
  ) {
    super(
      `Spanish (es) is not ready: status "${status}", ${missing.length} key(s) pending Sable. ` +
        'Spanish is served only when messages/es.status.json says "reviewed" and every key is present. ' +
        'Local QA only: FREEPLUG_I18N_ES_ALLOW_PENDING=1 serves the draft, missing keys in English.'
    )
  }
}

/**
 * Messages for a locale. English is the source. Spanish must be reviewed and complete (card C7: a
 * missing key fails, it does not quietly fall back), unless the local-QA override is set.
 */
export function messagesFor(
  locale: AppLocale,
  env: Record<string, string | undefined> = process.env,
  catalogs: { en: Tree; es: Tree; status?: SpanishStatus } = { en: EN_MESSAGES as unknown as Tree, es: ES_MESSAGES, status: ES_STATUS }
): Messages {
  if (locale === 'en') return catalogs.en as unknown as Messages
  const missing = missingKeys(catalogs.en, catalogs.es)
  const status = catalogs.status?.status ?? 'draft'
  if ((missing.length > 0 || status !== 'reviewed') && !allowPendingSpanish(env)) {
    throw new SpanishPendingError(missing, status)
  }
  return fillFrom(catalogs.en, catalogs.es, markPendingSpanish(env)) as unknown as Messages
}

/** Top-level namespaces a subtree needs on the client (keeps the payload small). */
export function pickNamespaces(messages: Messages, namespaces: readonly (keyof Messages)[]): Partial<Messages> {
  const out: Partial<Messages> = {}
  for (const ns of namespaces) (out as Record<string, unknown>)[ns] = messages[ns]
  return out
}
