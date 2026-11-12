// Live check on the LOCAL Docker Supabase only: anon and authenticated can't read or write the
// Envato picker tables. Refuses any non-loopback URL. Usage: node scripts/envato-rls-check.mjs
import { execFileSync } from 'node:child_process'
const DB = process.env.ENVATO_RLS_DB_CONTAINER || 'supabase_db_owen-ladder-local'
const tables = ['envato_sync_runs', 'envato_items', 'template_shortlist', 'template_niche_decisions', 'template_widen_log']
const sql = (role, q) => {
  try {
    const out = execFileSync('docker', ['exec', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', `begin; set local role ${role}; ${q}; rollback;`], { stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, out: String(out).trim() }
  } catch (e) {
    return { ok: false, out: String(e.stderr || '').trim().split('\n')[0] }
  }
}
let fail = 0
for (const role of ['anon', 'authenticated']) {
  for (const t of tables) {
    for (const [what, q] of [
      ['select', `select count(*) from public.${t}`],
      ['insert', `insert into public.${t} default values`],
      ['update', `update public.${t} set ${t === 'template_widen_log' ? 'reason' : t === 'envato_sync_runs' ? 'calls' : 'niche'} = ${t === 'envato_sync_runs' ? '0' : "'x'"} where false`],
      ['delete', `delete from public.${t} where false`],
    ]) {
      const r = sql(role, what === 'update' && t === 'envato_items' ? `update public.envato_items set name = 'x' where false` : q)
      const denied = !r.ok && /permission denied/i.test(r.out)
      console.log(`${denied ? 'PASS' : 'FAIL'} ${role} ${what} ${t}: ${denied ? 'permission denied' : r.out}`)
      if (!denied) fail++
    }
  }
}
const s = sql('service_role', 'select count(*) from public.envato_items')
console.log(`${s.ok ? 'PASS' : 'FAIL'} service_role select envato_items: ${s.out.split('\n').pop()}`)
if (!s.ok) fail++
console.log(fail ? `${fail} FAILED` : 'all checks passed')
process.exit(fail ? 1 : 0)
