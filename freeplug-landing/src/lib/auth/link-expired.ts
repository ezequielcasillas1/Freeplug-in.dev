/** Exact copy (Aria, round 6). The same page for an expired, used, malformed or incomplete email link. */
export const LINK_EXPIRED_MESSAGE = 'This link has expired. Request a new one.'

export type LinkExpiredFor = 'reset' | 'claim' | 'account'

/** Path of the neutral page; `for` only picks the link back (never reveals why the link failed). */
export function linkExpiredPath(forWhat: LinkExpiredFor): string {
  return `/link-expired?for=${forWhat}`
}
