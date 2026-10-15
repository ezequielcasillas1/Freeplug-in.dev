// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as copy from './ladder-copy'

/**
 * Vera N1 (Oct 3): the billing portal's cancel is off since 4d02033; the only cancel is the in-app
 * button on /dashboard/cancel. No customer-facing text may send anyone to the portal to cancel.
 * Scans every non-test source file under src/ (comments stripped) for string literals and JSX text
 * that mention both "cancel" and "portal".
 */
const SRC = path.join(__dirname, '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

/** String literals and JSX text in a source file, with comments removed. */
export function copyPieces(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const pieces: string[] = []
  for (const m of code.matchAll(/'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g)) pieces.push(m[1] ?? m[2] ?? m[3] ?? '')
  for (const m of code.matchAll(/>([^<>{}]+)</g)) pieces.push(m[1])
  return pieces
}

const sendsToPortalToCancel = (s: string) => /cancel/i.test(s) && /portal/i.test(s)

describe('Vera N1: no customer-facing copy sends anyone to the billing portal to cancel', () => {
  it('the scanner catches the old cancel page line (JSX text) and a string constant', () => {
    const old = `<p className="x">\n  If you still want to cancel, you can do so through the Stripe billing portal.\n</p>`
    expect(copyPieces(old).some(sendsToPortalToCancel)).toBe(true)
    expect(copyPieces(`export const X = 'To cancel, open the billing portal.'`).some(sendsToPortalToCancel)).toBe(true)
    expect(copyPieces(`/* cancel in the portal */ // cancel portal\nconst a = 1`).some(sendsToPortalToCancel)).toBe(false)
  })

  it('no source file under src/ has text mentioning both cancel and the portal', () => {
    const hits = sourceFiles(SRC).flatMap((f) =>
      copyPieces(readFileSync(f, 'utf8'))
        .filter(sendsToPortalToCancel)
        .map((s) => `${path.relative(SRC, f)}: ${s.trim().slice(0, 120)}`)
    )
    expect(hits).toEqual([])
  })

  it("Sable's final cancel page line, word for word, and never the portal", () => {
    expect(copy.CANCEL_IN_APP_LINE).toBe(
      'If you still want to cancel, use the button at the bottom of this box. Your access continues until the end of your current billing period.'
    )
    expect(copy.CANCEL_IN_APP_LINE).not.toMatch(/portal|stripe|manage billing/i)
  })
})
