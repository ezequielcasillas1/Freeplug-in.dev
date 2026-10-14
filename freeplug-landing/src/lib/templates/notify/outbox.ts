import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { OutMail, SendResult } from './notify'

/**
 * Dev/local transport: NOTHING is sent. Each email is written to the outbox folder (one .html + .txt per
 * email, plus index.jsonl) and listed on /admin/notify-outbox. Repeats of an idempotency key are skipped.
 * Folder: NOTIFY_OUTBOX_DIR, default <cwd>/.notify-outbox (gitignored).
 */
export function outboxDir(): string {
  return process.env.NOTIFY_OUTBOX_DIR?.trim() || path.join(process.cwd(), '.notify-outbox')
}

export type OutboxEntry = { key: string; to: string; subject: string; file: string; textFile: string; at: string; kind: 'email' | 'alert' }

const slug = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, '_').slice(0, 90)

export async function readOutbox(dir = outboxDir()): Promise<OutboxEntry[]> {
  try {
    const raw = await readFile(path.join(dir, 'index.jsonl'), 'utf8')
    return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l) as OutboxEntry)
  } catch {
    return []
  }
}

export async function writeOutbox(m: OutMail, kind: 'email' | 'alert' = 'email', dir = outboxDir()): Promise<SendResult> {
  try {
    await mkdir(dir, { recursive: true })
    if ((await readOutbox(dir)).some((e) => e.key === m.idempotencyKey)) return { ok: true, id: 'duplicate' }
    const base = `${Date.now()}-${slug(m.idempotencyKey)}`
    await writeFile(path.join(dir, `${base}.html`), m.html)
    await writeFile(path.join(dir, `${base}.txt`), `To: ${m.to}\nSubject: ${m.subject}\nIdempotency-Key: ${m.idempotencyKey}\n\n${m.text}`)
    const entry: OutboxEntry = { key: m.idempotencyKey, to: m.to, subject: m.subject, file: `${base}.html`, textFile: `${base}.txt`, at: new Date().toISOString(), kind }
    await appendFile(path.join(dir, 'index.jsonl'), JSON.stringify(entry) + '\n')
    return { ok: true, id: base }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'outbox write failed' }
  }
}
