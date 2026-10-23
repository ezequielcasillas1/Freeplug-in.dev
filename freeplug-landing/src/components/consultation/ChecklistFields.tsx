'use client'

import { useState } from 'react'
import {
  BOOKING_OPTIONS,
  buyoutPreview,
  CONTENT_SOURCES,
  DOMAIN_PATHS,
  FIELD_LABELS,
  FORM_KINDS,
  PAGE_COUNT_MAX,
  PAYMENT_OPTIONS,
  PHOTO_SOURCES,
  PLAN_CHOICES,
  SITE_TYPES,
  TEMPLATE_CHOICES,
  TIMELINES,
  type Checklist,
} from '@/lib/consultation/checklist'

type Option = { readonly id: string; readonly label: string }

const input =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white disabled:bg-zinc-50 disabled:text-gray-600'
const legend = 'text-sm font-medium text-gray-900 mb-2'

function Radios({
  name,
  options,
  value,
  onChange,
  disabled,
  required,
}: {
  name: keyof Checklist
  options: readonly Option[]
  value?: string
  onChange?: (v: string) => void
  disabled?: boolean
  required?: boolean
}) {
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className={legend}>
        {FIELD_LABELS[name]}
        {required ? ' *' : ''}
      </legend>
      {options.map((o) => (
        <label key={o.id} className="flex items-start gap-2 text-sm text-gray-700 min-h-[32px]">
          <input
            type="radio"
            name={name}
            value={o.id}
            defaultChecked={value === o.id}
            onChange={onChange ? () => onChange(o.id) : undefined}
            className="mt-1"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

function TextField({
  name,
  value,
  disabled,
  multiline,
  placeholder,
  type = 'text',
}: {
  name: keyof Checklist
  value?: string | number
  disabled?: boolean
  multiline?: boolean
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className={legend + ' block'}>{FIELD_LABELS[name]}</span>
      {multiline ? (
        <textarea name={name} defaultValue={value ?? ''} disabled={disabled} rows={3} className={input} placeholder={placeholder} />
      ) : (
        <input name={name} type={type} defaultValue={value ?? ''} disabled={disabled} className={input} placeholder={placeholder} />
      )}
    </label>
  )
}

/**
 * Every checklist field from the consultation card, used by the client's "Fill in the details" form
 * and the admin checklist editor (same names, so both post the same shape). Page count shows the
 * buyout tier live; the own-domain path shows the 20% buyout discount.
 */
export function ChecklistFields({ initial, disabled = false }: { initial: Checklist; disabled?: boolean }) {
  const [siteType, setSiteType] = useState(initial.site_type)
  const [pages, setPages] = useState<string>(initial.page_count != null ? String(initial.page_count) : '')
  const [domainPath, setDomainPath] = useState(initial.domain_path)
  const [booking, setBooking] = useState(initial.booking)
  const pageNum = /^\d+$/.test(pages) ? Number(pages) : undefined
  const preview = buyoutPreview(pageNum, domainPath)

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="ck-site">
        <h2 id="ck-site" className="text-lg font-semibold text-gray-900">Your website</h2>
        <Radios name="site_type" options={SITE_TYPES} value={initial.site_type} onChange={(v) => setSiteType(v as Checklist['site_type'])} disabled={disabled} required />
        {siteType === 'other' ? <TextField name="site_type_other" value={initial.site_type_other} disabled={disabled} /> : null}
        <label className="block">
          <span className={legend + ' block'}>{FIELD_LABELS.page_count} *</span>
          <input
            name="page_count"
            type="number"
            min={1}
            max={PAGE_COUNT_MAX}
            inputMode="numeric"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            disabled={disabled}
            className={input + ' max-w-[140px]'}
          />
          <span className="mt-2 block text-sm text-gray-600" aria-live="polite" data-testid="buyout-tier-live">
            {preview ? preview.line : 'Enter a page count to see your buyout tier.'}
          </span>
        </label>
        <TextField name="pages_wanted" value={initial.pages_wanted} disabled={disabled} multiline placeholder="Home, About, Services, Gallery, Contact…" />
        <Radios name="template_choice" options={TEMPLATE_CHOICES} value={initial.template_choice} disabled={disabled} required />
        <TextField name="example_sites" value={initial.example_sites} disabled={disabled} multiline placeholder="Links to websites you like, and what you like about them" />
      </section>

      <section className="space-y-4" aria-labelledby="ck-content">
        <h2 id="ck-content" className="text-lg font-semibold text-gray-900">Content and photos</h2>
        <Radios name="content_source" options={CONTENT_SOURCES} value={initial.content_source} disabled={disabled} required />
        <Radios name="photo_source" options={PHOTO_SOURCES} value={initial.photo_source} disabled={disabled} required />
        <TextField name="content_notes" value={initial.content_notes} disabled={disabled} multiline placeholder="Where to find your text, logo or photos" />
      </section>

      <section className="space-y-4" aria-labelledby="ck-domain">
        <h2 id="ck-domain" className="text-lg font-semibold text-gray-900">Domain</h2>
        <Radios name="domain_path" options={DOMAIN_PATHS} value={initial.domain_path} onChange={(v) => setDomainPath(v as Checklist['domain_path'])} disabled={disabled} required />
        {domainPath === 'own' ? <TextField name="domain_name" value={initial.domain_name} disabled={disabled} placeholder="mybusiness.com" /> : null}
        {domainPath === 'freeplug' ? <TextField name="domain_name" value={initial.domain_name} disabled={disabled} placeholder="Name you'd like (optional), e.g. mybusiness.com" /> : null}
      </section>

      <section className="space-y-4" aria-labelledby="ck-features">
        <h2 id="ck-features" className="text-lg font-semibold text-gray-900">Forms, booking and payments</h2>
        <fieldset className="space-y-1" disabled={disabled}>
          <legend className={legend}>{FIELD_LABELS.forms} *</legend>
          {FORM_KINDS.map((o) => (
            <label key={o.id} className="flex items-start gap-2 text-sm text-gray-700 min-h-[32px]">
              <input type="checkbox" name="forms" value={o.id} defaultChecked={initial.forms?.includes(o.id)} className="mt-1" />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        <Radios name="booking" options={BOOKING_OPTIONS} value={initial.booking} onChange={(v) => setBooking(v as Checklist['booking'])} disabled={disabled} required />
        {booking === 'link' ? <TextField name="booking_tool" value={initial.booking_tool} disabled={disabled} placeholder="e.g. Square, Calendly, Vagaro" /> : null}
        <Radios name="payments" options={PAYMENT_OPTIONS} value={initial.payments} disabled={disabled} required />
      </section>

      <section className="space-y-4" aria-labelledby="ck-plan">
        <h2 id="ck-plan" className="text-lg font-semibold text-gray-900">Plan and timeline</h2>
        <Radios name="plan" options={PLAN_CHOICES} value={initial.plan} disabled={disabled} required />
        <Radios name="timeline" options={TIMELINES} value={initial.timeline} disabled={disabled} required />
        <TextField name="deadline_reason" value={initial.deadline_reason} disabled={disabled} placeholder="Opening date, event, season… (optional)" />
        <TextField name="notes" value={initial.notes} disabled={disabled} multiline />
      </section>
    </div>
  )
}
