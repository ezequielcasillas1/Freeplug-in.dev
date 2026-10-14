import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { assertAdminAccess } from '@/lib/admin/guard'
import { outboxDir, readOutbox } from '@/lib/templates/notify/outbox'
import { isRealSendEnabled, notifyDeps } from '@/lib/templates/notify/server'
import { devAlarm } from '@/lib/templates/notify/alarm'
import { fireAlarmsNow, sendFailedAgain } from './actions'

export const dynamic = 'force-dynamic'

/** Local outbox for the template-pick admin emails. Dev only: nothing is really sent there. */
export default async function NotifyOutboxPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await assertAdminAccess()
  if (isRealSendEnabled()) notFound()
  const entries = (await readOutbox()).reverse()
  let failed: Awaited<ReturnType<ReturnType<typeof notifyDeps>['log']['listFailed']>> = []
  let failedError = false
  try { failed = await notifyDeps().log.listFailed() } catch { failedError = true }
  const pending = devAlarm().pending()
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
      <section className="mb-4" data-testid="failed-notifications">
        <h3 className="font-semibold mb-1">Failed notifications</h3>
        {failedError && <p className="text-sm text-red-700">Could not load the notify log.</p>}
        {!failedError && failed.length === 0 && <p className="text-sm text-zinc-600">None.</p>}
        <ul className="text-sm space-y-1">
          {failed.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2">
              <span>{f.event} · request {f.requestId} · v{f.pickVersion} · {f.attempts} attempt(s) · {f.lastError}</span>
              <form action={sendFailedAgain}>
                <input type="hidden" name="id" value={f.id} />
                <button type="submit" className="rounded border bg-white px-2 py-0.5">Send again</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-4">
        <h3 className="font-semibold mb-1">Pending change alarms (dev)</h3>
        <ul className="text-sm mb-1">
          {pending.map((p) => <li key={p.requestId}>request {p.requestId} · v{p.pickVersion} · fires {p.fireAt}</li>)}
          {pending.length === 0 && <li className="text-zinc-600">None.</li>}
        </ul>
        <form action={fireAlarmsNow}>
          <button type="submit" className="rounded border bg-white px-3 py-1 text-sm">Fire alarm now</button>
        </form>
      </section>
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
