// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// City photos (Lina/Jace, Oct 3): served as-is, explicit 800x600 so nothing jumps, lazy because they sit below
// the first screen at 375px and desktop. Not re-encoded / WebP until Jace's speed check on the preview.
const root = path.join(__dirname, '../../../..')
const source = readFileSync(path.join(__dirname, 'OutreachSection.tsx'), 'utf8')

// Texas city photos are Wikimedia Commons files (Oct 2026): new names so no cached old file is reused, and each
// card must show its CC credit (author + license link + source).
const photoDir = path.join(root, 'public/images/outreach')

function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2
  while (i < buf.length) {
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc2) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    i += 2 + len
  }
  throw new Error('no SOF')
}

describe('OutreachSection city photos', () => {
  const tags = source.match(/<Image\b[\s\S]*?\/>/g) ?? []

  it('every <Image> has explicit 800x600, loads lazily, and is not fill/priority/preload', () => {
    expect(tags).toHaveLength(2)
    for (const t of tags) {
      expect(t).toMatch(/width=\{800\}/)
      expect(t).toMatch(/height=\{600\}/)
      expect(t).toMatch(/loading="lazy"/)
      expect(t).toMatch(/\bunoptimized\b/)
      expect(t).not.toMatch(/\bfill\b|\bpriority\b|\bpreload\b|fetchPriority/)
    }
  })

  it('the 7 referenced JPGs exist and really are 800x600 (so the attributes are true)', () => {
    const referenced = [...new Set(source.match(/\/images\/outreach\/[a-z0-9-]+\.jpg/g) ?? [])].sort()
    const onDisk = readdirSync(photoDir).filter((f) => f.endsWith('.jpg')).map((f) => `/images/outreach/${f}`).sort()
    expect(referenced).toEqual(onDisk)
    expect(onDisk).toHaveLength(7)
    for (const f of onDisk) expect(jpegSize(readFileSync(path.join(root, 'public', f)))).toEqual({ width: 800, height: 600 })
  })
})

describe('OutreachSection Texas city photo credits', () => {
  const files = ['san-marcos', 'kyle', 'new-braunfels', 'san-antonio', 'austin'].map((n) => `/images/outreach/${n}-2026-10.jpg`)

  it('uses the new 2026-10 Commons files, not the old stock photos', () => {
    for (const f of files) expect(source).toContain(f)
    expect(source).not.toMatch(/\/images\/outreach\/(san-marcos|kyle|new-braunfels|san-antonio|austin)\.jpg/)
  })

  it('every city has an author, a CC license with link, and a Commons source, and the card renders them', () => {
    expect(source.match(/author: '/g)).toHaveLength(5)
    expect(source.match(/licenseUrl: 'https:\/\/creativecommons\.org\/licenses\//g)).toHaveLength(5)
    expect(source.match(/source: 'https:\/\/commons\.wikimedia\.org\/wiki\/File:/g)).toHaveLength(5)
    expect(source).toContain('Photo: {city.credit.author}')
    expect(source).toContain('{city.credit.license}')
    const credits = readFileSync(path.join(photoDir, 'CREDITS.md'), 'utf8')
    for (const f of files) expect(credits).toContain(path.basename(f))
  })
})
