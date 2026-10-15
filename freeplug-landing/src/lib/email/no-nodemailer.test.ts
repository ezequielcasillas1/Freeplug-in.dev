// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * Resend primary (Oct 3, Jace + Aria): nodemailer and @types/nodemailer are removed. These checks keep
 * them from coming back (the ESLint rules in eslint.config.mjs do the same at lint time). To go back on
 * purpose, apply resend-primary.patch in reverse (it restores these files too).
 */
const ROOT = path.resolve(__dirname, '../../..')
const SELF = path.relative(ROOT, __filename)
const SKIP_DIRS = new Set(['node_modules', '.next', '.open-next', '.wrangler', '.git', 'out', 'build', 'coverage'])
const CODE = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.owen-backup-')) continue
    const p = path.join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) yield* walk(p)
    else if (CODE.test(name)) yield p
  }
}

describe('nodemailer stays removed', () => {
  it('package.json has no nodemailer or @types/nodemailer in any dependency list', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides']) {
      const names = Object.keys(pkg[k] ?? {})
      expect(names.filter((n) => /nodemailer/i.test(n)), k).toEqual([])
    }
  })

  it('package-lock.json does not mention nodemailer', () => {
    expect(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')).not.toMatch(/nodemailer/i)
  })

  it('no source file imports or requires nodemailer', () => {
    const offenders: string[] = []
    const re = /(from\s+['"]nodemailer(\/[^'"]*)?['"]|require\(\s*['"]nodemailer|import\(\s*['"]nodemailer|import\s+['"]nodemailer)/
    for (const file of walk(ROOT)) {
      const rel = path.relative(ROOT, file)
      if (rel === SELF) continue
      if (re.test(readFileSync(file, 'utf8'))) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })

  it('no SMTP transport settings are read by app code', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(ROOT, 'src'))) {
      if (/\.test\.tsx?$/.test(file)) continue
      if (/process\.env(\.|\[['"])SMTP_/.test(readFileSync(file, 'utf8'))) offenders.push(path.relative(ROOT, file))
    }
    expect(offenders).toEqual([])
  })

  it('ESLint rejects nodemailer in app code, tests, scripts and root config (import, require, import())', async () => {
    const eslint = new ESLint({ cwd: ROOT })
    const samples: [string, string][] = [
      ['src/lib/email/x-sample.ts', "import nodemailer from 'nodemailer'\nexport const t = nodemailer\n"],
      ['src/lib/email/x-sample.test.ts', "import { createTransport } from 'nodemailer'\nexport const t = createTransport\n"],
      ['src/app/admin/x-sample.ts', "import type { Transporter } from 'nodemailer/lib/smtp-transport'\nexport type T = Transporter\n"],
      ['scripts/x-sample.mjs', "const n = await import('nodemailer')\nexport default n\n"],
      ['x-sample.config.mjs', "import n from 'nodemailer'\nexport default n\n"],
      ['test/x-sample.ts', "// eslint-disable-next-line @typescript-eslint/no-require-imports\nconst n = require('nodemailer')\nexport default n\n"],
    ]
    for (const [filePath, code] of samples) {
      const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) })
      const msgs = result.messages.filter((m) => /nodemailer was removed/.test(m.message))
      expect(msgs.length, filePath).toBeGreaterThan(0)
      expect(msgs.every((m) => m.severity === 2), filePath).toBe(true)
    }
    const [ok] = await eslint.lintText("import { Resend } from 'resend'\nexport const r = Resend\n", {
      filePath: path.join(ROOT, 'src/lib/email/x-ok.ts'),
    })
    expect(ok.messages.filter((m) => m.severity === 2)).toEqual([])
  }, 120_000)
})

describe('Resend key handling', () => {
  it('wrangler.jsonc never names RESEND_API_KEY (Worker secret only: wrangler versions secret put)', () => {
    expect(readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8')).not.toContain('RESEND_API_KEY')
  })

  it('tests cannot reach api.resend.com (vitest.setup.ts fetch guard)', async () => {
    await expect(fetch('https://api.resend.com/emails', { method: 'POST', body: '{}' })).rejects.toThrow(/Blocked in tests/)
  })
})
