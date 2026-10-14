import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { assertAdminAccess } from '@/lib/admin/guard'
import { outboxDir, readOutbox } from '@/lib/templates/notify/outbox'
import { isRealSendEnabled } from '@/lib/templates/notify/server'
import { runDueNotifications } from './actions'

export const dynamic = 'force-dynamic'

/** Local outbox for the template-pick admin emails. Dev only: nothing is really sent there. */
export default async function NotifyOutboxPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await assertAdminAccess()
  if (isRealSendEnabled()) notFound()
  const entries = (await readOutbox()).reverse()
  const { f } = await searchParams
  const pick = entries.find((e) => e.file === f) ?? entries[0]
  let html = ''
  if (pick && path.basename(pick.file) === pick.file) {
    try { html = await readFile(path.join(outboxDir(), pick.file), 'utf8') } catch { html = '' }
  }
  return (
    <div data-testid="notify-outbox">
      <h2 className="text-xl font-semibold mb-1">Notify outbox (local, nothing sent)</h2>
      <p className="text-sm text-zinc-600 mb-3">Folder: {outboxDir()}</p>
      <form action={runDueNotifications} className="mb-3">
        <button type="submit" className="rounded border bg-white px-3 py-1 text-sm">Run due notifications now</button>
      </form>
      <ul className="mb-4 text-sm space-y-1">
        {entries.map((e) => (
          <li key={e.file}>
            <a href={`/admin/notify-outbox?f=${encodeURIComponent(e.file)}`} className={e.file === pick?.file ? 'font-semibold underline' : 'underline'}>
              [{e.kind}] {e.subject}
            </a>{' '}
            <span className="text-zinc-500">{e.at} · {e.key}</span>
          </li>
        ))}
        {entries.length === 0 && <li>Empty.</li>}
      </ul>
      {html && (
        <iframe title="email preview" sandbox="" srcDoc={html} className="w-full bg-white border" style={{ height: 900 }} />
      )}
    </div>
  )
}
