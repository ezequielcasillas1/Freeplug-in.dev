'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DETAIL_KEYS, type DetailKey } from '@/lib/outreach/schemas'
import { emptyAdminSiteForm, parseRioImport, type AdminSiteFormValues } from '@/lib/outreach/rio-import'
import { prepareScreenshot } from '@/lib/outreach/client-image'
import { createOutreachSiteAction, uploadScreenshotAction } from './actions'
import { CopyLinkButton } from './CopyLinkButton'
import { ADMIN_FIELD_LABELS } from '@/lib/outreach/admin-labels'

const INPUT =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'
const FIELD_NAMES: Record<DetailKey, string> = ADMIN_FIELD_LABELS

/**
 * Admin "New outreach site": business name, email, Rio's pre-filled details with source labels
 * (typed in, or imported from Rio's JSON by paste or upload), services, and the two full-page
 * screenshots. Saving generates the private link (shown once, with "Copy link"); no email is sent.
 */
export function NewOutreachSiteForm() {
  const [values, setValues] = useState<AdminSiteFormValues>(emptyAdminSiteForm)
  const [json, setJson] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [desktopShot, setDesktopShot] = useState<File | null>(null)
  const [mobileShot, setMobileShot] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  function runImport(text: string) {
    const res = parseRioImport(text)
    if (res.ok) {
      setValues(res.values)
      setImportMsg({ ok: true, text: `Imported ${res.values.businessName} (${res.values.services.length} services).` })
    } else setImportMsg({ ok: false, text: res.error })
  }

  const setField = (k: DetailKey, part: 'value' | 'source' | 'source_url', v: string) =>
    setValues((cur) => ({ ...cur, prefill: { ...cur.prefill, [k]: { ...cur.prefill[k], [part]: v } } }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await createOutreachSiteAction(values)
      if (!res.ok) {
        setError(res.error)
        return
      }
      for (const [kind, file, width] of [
        ['desktop', desktopShot, 1440],
        ['mobile', mobileShot, 1440],
      ] as const) {
        if (!file) continue
        const blob = await prepareScreenshot(file, width)
        const fd = new FormData()
        fd.set('siteId', res.siteId)
        fd.set('kind', kind)
        fd.set('file', blob, `${kind}.jpg`)
        const up = await uploadScreenshotAction(fd)
        if (!up.ok) setError(`Site saved, but the ${kind} screenshot failed: ${up.error}`)
      }
      setLink(res.link)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  if (link) {
    return (
      <div className="space-y-3" data-testid="new-site-link">
        <p className="text-sm text-gray-800">Link created for {values.businessName}. It is shown only once.</p>
        <CopyLinkButton link={link} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          className="text-sm font-semibold text-[#ba3d3d] hover:underline"
          onClick={() => {
            setLink(null)
            setValues(emptyAdminSiteForm())
            setJson('')
            setImportMsg(null)
            setDesktopShot(null)
            setMobileShot(null)
            setError(null)
          }}
        >
          New outreach site
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="new-site-form">
      <fieldset className="rounded-lg border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">Import Rio&apos;s pre-fill JSON</legend>
        <textarea
          rows={4}
          className={`${INPUT} font-mono text-xs`}
          placeholder='{"business_name": "...", "email": null, "fields": {...}, "services": [...]}'
          value={json}
          onChange={(e) => setJson(e.target.value)}
          aria-label="Rio's pre-fill JSON"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => runImport(json)} disabled={!json.trim()}>
            Import
          </Button>
          <label className="cursor-pointer text-sm font-semibold text-[#ba3d3d] hover:underline">
            Upload .json
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                if (f.size > 200_000) {
                  setImportMsg({ ok: false, text: 'That file is too large for a pre-fill file.' })
                  return
                }
                const text = await f.text()
                setJson(text)
                runImport(text)
              }}
            />
          </label>
          {importMsg ? (
            <span className={`text-sm ${importMsg.ok ? 'text-green-700' : 'text-red-700'}`} role="status">
              {importMsg.text}
            </span>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="biz">
            Business name
          </label>
          <input id="biz" className={INPUT} required maxLength={200} value={values.businessName} onChange={(e) => setValues({ ...values, businessName: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="biz-email">
            Business email (optional)
          </label>
          <input id="biz-email" type="email" className={INPUT} maxLength={320} value={values.contactEmail} onChange={(e) => setValues({ ...values, contactEmail: e.target.value })} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Pre-filled details (blank = the customer fills it in)</h3>
        {DETAIL_KEYS.map((k) => (
          <div key={k} className="grid gap-2 md:grid-cols-[1fr_12rem_1fr]">
            <div>
              <label className={LABEL} htmlFor={`pf-${k}`}>
                {FIELD_NAMES[k]}
              </label>
              <input id={`pf-${k}`} className={INPUT} maxLength={500} value={values.prefill[k].value} onChange={(e) => setField(k, 'value', e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor={`pf-${k}-src`}>
                Source label
              </label>
              <input id={`pf-${k}-src`} className={INPUT} maxLength={100} placeholder="Thumbtack profile" value={values.prefill[k].source} onChange={(e) => setField(k, 'source', e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor={`pf-${k}-url`}>
                Source link (admin only)
              </label>
              <input id={`pf-${k}-url`} className={INPUT} maxLength={2000} value={values.prefill[k].source_url} onChange={(e) => setField(k, 'source_url', e.target.value)} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Services on the built site ({values.services.length})</h3>
        {values.services.map((s, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_16rem_1fr_auto]" data-testid="admin-service-row">
            <input
              aria-label="Service name"
              className={INPUT}
              maxLength={100}
              value={s.name}
              onChange={(e) => setValues({ ...values, services: values.services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
            />
            <input
              aria-label="Service source label"
              className={INPUT}
              maxLength={100}
              value={s.source}
              onChange={(e) => setValues({ ...values, services: values.services.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })}
            />
            <input
              aria-label="Service source link (admin only)"
              className={INPUT}
              maxLength={2000}
              value={s.source_url}
              onChange={(e) => setValues({ ...values, services: values.services.map((x, j) => (j === i ? { ...x, source_url: e.target.value } : x)) })}
            />
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-800"
              onClick={() => setValues({ ...values, services: values.services.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-semibold text-[#ba3d3d] hover:underline"
          onClick={() => setValues({ ...values, services: [...values.services, { name: '', source: '', source_url: '' }] })}
        >
          Add a service
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="shot-desktop">
            Desktop screenshot (full page)
          </label>
          <input id="shot-desktop" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setDesktopShot(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="shot-mobile">
            Phone screenshot (full page)
          </label>
          <input id="shot-mobile" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setMobileShot(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      <Button type="submit" disabled={pending || !values.businessName.trim()}>
        {pending ? 'Saving…' : 'Create preview link'}
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
