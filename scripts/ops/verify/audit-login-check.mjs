import { chromium } from '/workspace/pw2/node_modules/playwright-core/index.mjs'; import fs from 'node:fs'
const t = fs.readFileSync('/workspace/owen/audit-wt/QUINN-LOGIN.txt','utf8')
const email = t.match(/^Email: (.*)$/m)[1], password = t.match(/^Password: (.*)$/m)[1]
const B='http://localhost:3465'
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const p = await b.newPage(); const errs = []
p.on('pageerror', e => errs.push(String(e)))
await p.goto(B+'/login', { waitUntil: 'networkidle', timeout: 120000 })
await p.fill('input[type=email], input[name=email]', email)
await p.fill('input[type=password], input[name=password]', password)
await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 90000 }), p.locator('form:has(input[name=password]) button[type=submit]').click()])
console.log('after login:', new URL(p.url()).pathname)
for (const path of ['/dashboard','/dashboard/website','/dashboard/request-website','/dashboard/plans','/dashboard/help','/dashboard/settings','/dashboard/domain','/dashboard/photos','/dashboard/consultation','/dashboard/cancel']) {
  const r = await p.goto(B + path, { waitUntil: 'networkidle', timeout: 120000 }).catch(e=>null)
  const body = (await p.locator('body').innerText().catch(()=>''))
  console.log(path, r?.status(), '->', new URL(p.url()).pathname, '|', (await p.locator('h1').first().textContent({timeout:3000}).catch(() => '-'))?.trim().slice(0, 60), /Quinn's Test Bakery/.test(body)?'[shows request]':'', /error|went wrong/i.test(body)?'[error text]':'')
}
console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none')
await b.close()
