import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function deepValues(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (Array.isArray(obj)) return obj.flatMap(deepValues)
  if (obj && typeof obj === 'object') return Object.values(obj).flatMap(deepValues)
  return []
}

const messagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../messages')

describe('buyer-facing merch copy', () => {
  it('does not expose the Supreme trademark in EN/ES message strings', () => {
    const en = JSON.parse(readFileSync(path.join(messagesDir, 'en.json'), 'utf8')) as { public: { merch: unknown } }
    const es = JSON.parse(readFileSync(path.join(messagesDir, 'es.json'), 'utf8')) as { public: { merch: unknown } }
    const blob = [...deepValues(en.public.merch), ...deepValues(es.public.merch)].join('\n')
    expect(blob.toLowerCase()).not.toContain('supreme')
  })
})
