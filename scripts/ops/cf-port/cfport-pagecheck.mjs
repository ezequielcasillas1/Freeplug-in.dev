import '/workspace/owen/scrub-env.mjs' // bot secrets: never read or inherited (Oct 3 audit)
// Headless Chrome check of the landing page (CF port). Only 127.0.0.1 resolves; everything else is blocked.
// Usage: node cfport-pagecheck.mjs <url> <label>
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const url = process.argv[2] ?? 'http://127.0.0.1:3340/'
const label = process.argv[3] ?? 'run'
const dir = mkdtempSync(path.join(os.tmpdir(), 'cfchrome-'))
const chrome = spawn('google-chrome', [
  '--headless=new', '--remote-debugging-port=3345', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${dir}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
  '--disable-sync', '--disable-default-apps', '--disable-extensions', '--metrics-recording-only', '--no-sandbox',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try { target = (await (await fetch('http://127.0.0.1:3345/json/list')).json()).find((t) => t.type === 'page') } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
const events = []
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } else events.push(msg)
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value

await send('Network.enable')
await send('Page.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__cls = 0; window.__shifts = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources||[]).map(s => s.node && (s.node.tagName + (s.node.className ? '.' + String(s.node.className).split(' ')[0] : '')) ).filter(Boolean).slice(0,3) }) } } }).observe({ type: 'layout-shift', buffered: true });
` })

async function run(vp) {
  events.length = 0
  await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: vp.mobile })
  await send('Page.navigate', { url })
  for (let i = 0; i < 100; i++) { await sleep(100); if (events.some((e) => e.method === 'Page.loadEventFired')) break }
  await sleep(1500)
  const imgBytes = () => {
    const urls = new Map()
    for (const e of events) if (e.method === 'Network.responseReceived' && /\/images\/outreach\//.test(e.params.response.url)) urls.set(e.params.requestId, { url: e.params.response.url.replace(/^.*\/images/, '/images'), status: e.params.response.status, headers: e.params.response.headers })
    let bytes = 0
    for (const e of events) if (e.method === 'Network.loadingFinished' && urls.has(e.params.requestId)) { urls.get(e.params.requestId).bytes = e.params.encodedDataLength; bytes += e.params.encodedDataLength }
    return { count: urls.size, bytes, list: [...urls.values()] }
  }
  const initial = imgBytes()
  const layout = await evalJs(`JSON.stringify([...document.querySelectorAll('img[src*="/images/outreach/"]')].map(i => { const r = i.getBoundingClientRect(); return { src: i.getAttribute('src').split('/').pop(), loading: i.getAttribute('loading'), w: i.getAttribute('width'), h: i.getAttribute('height'), top: Math.round(r.top + scrollY), boxW: Math.round(r.width), boxH: Math.round(r.height), aboveFold: r.top < innerHeight } }))`)
  const clsBeforeScroll = await evalJs('window.__cls')
  await evalJs(`(async () => { for (let y = 0; y <= document.body.scrollHeight; y += Math.round(innerHeight/2)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } await new Promise(r => setTimeout(r, 1500)); return 1 })()`)
  const after = imgBytes()
  const loaded = await evalJs(`JSON.stringify([...document.querySelectorAll('img[src*="/images/outreach/"]')].map(i => ({ src: i.getAttribute('src').split('/').pop(), complete: i.complete, natural: i.naturalWidth + 'x' + i.naturalHeight, box: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height) })))`)
  const cls = await evalJs('window.__cls')
  const shifts = await evalJs('JSON.stringify(window.__shifts)')
  const sample = after.list[0]?.headers ?? {}
  const pick = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => /x-frame|x-content-type|referrer|x-robots|content-type|cache-control/i.test(k)))
  console.log(JSON.stringify({ label, viewport: vp.name, initialImageRequests: initial.count, initialImageBytes: initial.bytes, afterScrollImageRequests: after.count, afterScrollImageBytes: after.bytes, statuses: [...new Set(after.list.map((x) => x.status))], clsBeforeScroll: +(+clsBeforeScroll).toFixed(4), clsAfterScroll: +(+cls).toFixed(4), shifts: JSON.parse(shifts), imageHeaders: pick(sample), layout: JSON.parse(layout), loaded: JSON.parse(loaded) }, null, 1))
}
try {
  await run({ name: '375x812 mobile', w: 375, h: 812, dpr: 2, mobile: true })
  await run({ name: '1440x900 desktop', w: 1440, h: 900, dpr: 1, mobile: false })
} finally {
  ws.close(); chrome.kill('SIGKILL'); await sleep(300); rmSync(dir, { recursive: true, force: true })
}
