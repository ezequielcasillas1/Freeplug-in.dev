// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/** Lina/Vera (Oct 13): both banner buttons have a 44px tap area; dismiss stays a plain text button. */
const src = readFileSync(path.join(__dirname, 'LanguageBanner.tsx'), 'utf8')
const buttons = [...src.matchAll(/<button[^>]*className="([^"]*)"/g)].map((m) => m[1])

describe('LanguageBanner buttons', () => {
  it('has the accept and dismiss buttons', () => expect(buttons).toHaveLength(2))
  it('accept: filled, min-height 44px', () => {
    expect(buttons[0]).toContain('min-h-[44px]')
    expect(buttons[0]).toContain('bg-[#ba3d3d]')
  })
  it('dismiss (No, gracias / No thanks): 44px tap area, no fill, no border', () => {
    expect(buttons[1]).toContain('min-h-[44px]')
    expect(buttons[1]).not.toMatch(/(^|\s)(bg-|border)/)
  })
  it('prompt stays on one line', () => expect(src).toMatch(/data-testid="language-banner-prompt" className="[^"]*whitespace-nowrap/))
})
