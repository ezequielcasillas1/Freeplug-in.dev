// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { smsEnabled } from './gate'

const ROOT = path.resolve(__dirname, '../../..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) return name === 'node_modules' || name === '.next' ? [] : sourceFiles(p)
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) && p !== __filename && p !== path.join(__dirname, 'gate.ts') ? [p] : []
  })
}

describe('SMS is off at launch (Cheke, Oct 13: email only via Resend)', () => {
  it('is off by default: FREEPLUG_SMS_ENABLED unset, empty or anything but "on" means off', () => {
    expect(smsEnabled({})).toBe(false)
    for (const v of ['', 'off', '0', 'false', 'true', '1', 'ON', ' on']) expect(smsEnabled({ FREEPLUG_SMS_ENABLED: v })).toBe(false)
    expect(smsEnabled({ FREEPLUG_SMS_ENABLED: 'on' })).toBe(true)
  })

  it('the test environment itself has SMS off', () => {
    expect(smsEnabled()).toBe(false)
  })

  it('no Twilio client, API host or env var anywhere in the app or scripts, and no SMS-provider dependency', () => {
    const offenders = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'scripts'))].filter((f) =>
      /twilio|TWILIO_|api\.twilio\.com|messagingServiceSid|10dlc/i.test(readFileSync(f, 'utf8'))
    )
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([])
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    expect(deps.filter((d) => /twilio|vonage|nexmo|plivo|messagebird|sinch|telnyx/i.test(d))).toEqual([])
  })
})
