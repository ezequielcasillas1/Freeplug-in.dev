import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BLANK_FIELD_HINT, SEND_DETAILS_LABEL, SERVICE_SOURCE_SITE, SERVICE_SOURCE_SITE_AND_THUMBTACK } from '@/lib/outreach/copy'
import { parseRioImport } from '@/lib/outreach/rio-import'
import { readPrefill, readServiceSources } from '@/lib/outreach/schemas'
import { DetailsForm, type DetailsPayload } from './DetailsForm'

vi.mock('@/components/turnstile/Turnstile', () => ({ Turnstile: () => null }))

// Gracia's Lawn Service, exactly as the admin import stores it and the preview page reads it.
const imported = parseRioImport(readFileSync(path.join(__dirname, '../../../supabase/fixtures/gracias-lawn-service.prefill.json'), 'utf8'))
if (!imported.ok) throw new Error(imported.error)
const prefill = readPrefill(imported.values.prefill)
const services = readServiceSources(
  imported.values.services.map((s) => s.name),
  imported.values.services.map((s) => ({ name: s.name, source_label: s.source, source_url: s.source_url }))
)

// A service that is NOT in Rio's file (made up for this test only; never put it in a fixture).
const INLINE_ADDED_SERVICE = 'Test-only added service'

function renderForm(onSubmit = vi.fn(async () => ({ ok: true as const, submissionId: 'sub-1' }))) {
  render(
    <DetailsForm
      mode="preview"
      prefill={prefill}
      services={services}
      submitLabel={SEND_DETAILS_LABEL}
      successText="Thanks"
      lockUntilComplete={false}
      onSubmit={onSubmit}
      uploadPhoto={async () => ({ ok: true })}
    />
  )
  return onSubmit
}

describe("details form with Gracia's Lawn Service", () => {
  it('(a) blank fields show the blank hint and no source line', () => {
    renderForm()
    for (const key of ['phone', 'address', 'quote_email']) {
      const row = screen.getByTestId(`field-${key}`)
      expect(row).toHaveTextContent(BLANK_FIELD_HINT)
      expect(within(row).queryByTestId(`source-${key}`)).toBeNull()
      expect(row).not.toHaveTextContent('From your')
    }
  })

  it('(b) hours are a pre-filled value with "Looks right" and "Edit", never locked', () => {
    renderForm()
    const row = screen.getByTestId('field-hours')
    expect(within(row).getByTestId('value-hours')).toHaveTextContent('Sun–Sat 8:00 am – 6:00 pm')
    expect(within(row).getByTestId('source-hours')).toHaveTextContent('From your Thumbtack profile')
    expect(within(row).getByRole('button', { name: 'Looks right' })).toBeEnabled()
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    const box = within(screen.getByTestId('field-hours')).getByRole('textbox')
    expect(box.tagName).toBe('TEXTAREA')
    expect(box).toHaveValue('Sun–Sat 8:00 am – 6:00 pm')
    expect(box).not.toHaveAttribute('readonly')
    expect(box).toBeEnabled()
    fireEvent.change(box, { target: { value: 'Mon–Sat 8:00 am – 6:00 pm' } })
    expect(box).toHaveValue('Mon–Sat 8:00 am – 6:00 pm')
  })

  it('lists the six services from the built site with their source lines', () => {
    renderForm()
    expect(screen.getByTestId('service-source-Lawn mowing')).toHaveTextContent(SERVICE_SOURCE_SITE_AND_THUMBTACK)
    expect(screen.getByTestId('service-source-Bush trimming')).toHaveTextContent(SERVICE_SOURCE_SITE)
    expect(within(screen.getByTestId('services')).getAllByRole('listitem')).toHaveLength(6)
  })

  it('(c) Remove works on a Thumbtack-labelled service, with Undo', () => {
    renderForm()
    const row = () => screen.getByTestId('service-Lawn mowing')
    fireEvent.click(within(row()).getByRole('button', { name: 'Remove' }))
    expect(within(row()).getByText('Lawn mowing')).toHaveClass('line-through')
    fireEvent.click(within(row()).getByRole('button', { name: 'Undo' }))
    expect(within(row()).getByText('Lawn mowing')).not.toHaveClass('line-through')
    fireEvent.click(within(row()).getByRole('button', { name: 'Remove' }))
  })

  it('(d) "Add a service" adds an inline service as Keep and sends it with the details (for review only)', async () => {
    const onSubmit = renderForm()
    fireEvent.click(within(screen.getByTestId('service-Lawn mowing')).getByRole('button', { name: 'Remove' }))
    fireEvent.change(screen.getByLabelText('Add a service'), { target: { value: INLINE_ADDED_SERVICE } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(within(screen.getByTestId(`service-${INLINE_ADDED_SERVICE}`)).getByRole('button', { name: 'Keep' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = (onSubmit.mock.calls[0] as unknown as [DetailsPayload])[0]
    expect(payload.services).toEqual([
      { name: 'Lawn mowing', keep: false },
      { name: INLINE_ADDED_SERVICE, keep: true },
    ])
    // Untouched pre-filled hours are not a confirmation, so they are not sent (Vera r2 bug 2).
    expect(payload.fields).toEqual({})
  })

  it('the preview "Send my details" button is never locked', () => {
    renderForm()
    expect(screen.getByRole('button', { name: SEND_DETAILS_LABEL })).toBeEnabled()
  })
})

describe('round 3: the phone is sent once, never doubled', () => {
  // The admin screenshot showed "512-555-0142512-555-0142". Cause: the browser script typed into
  // the step 2 phone box, which already holds the number sent from the preview (page.type adds to
  // the existing text). The form itself never appends: these tests pin that down.
  function renderClaim(onSubmit: (p: DetailsPayload) => Promise<{ ok: true; submissionId: string }>) {
    render(
      <DetailsForm
        mode="claim"
        prefill={{ ...prefill, phone: { value: '512-555-0100', source: 'Thumbtack profile' } }}
        services={services}
        submitLabel="Confirm details"
        successText=""
        lockUntilComplete={false}
        initialFields={{ hours: 'Mon–Sat 8–6' }}
        onSubmit={onSubmit}
        uploadPhoto={async () => ({ ok: true })}
      />
    )
  }

  it('Edit opens the box with the old value once, and typing a new number replaces it', async () => {
    const onSubmit = vi.fn<(p: DetailsPayload) => Promise<{ ok: true; submissionId: string }>>(async () => ({ ok: true, submissionId: 's' }))
    renderClaim(onSubmit)
    fireEvent.click(within(screen.getByTestId('field-phone')).getByRole('button', { name: 'Edit' }))
    const box = within(screen.getByTestId('field-phone')).getByRole('textbox')
    expect(box).toHaveValue('512-555-0100')
    fireEvent.change(box, { target: { value: '512-555-0142' } })
    expect(box).toHaveValue('512-555-0142')
    fireEvent.submit(screen.getByTestId('details-form-claim'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].fields.phone).toBe('512-555-0142')
  })

  it('a value sent from the preview shows once in its box and is sent unchanged', async () => {
    const onSubmit = vi.fn<(p: DetailsPayload) => Promise<{ ok: true; submissionId: string }>>(async () => ({ ok: true, submissionId: 's' }))
    render(
      <DetailsForm
        mode="claim"
        prefill={prefill}
        services={services}
        submitLabel="Confirm details"
        successText=""
        lockUntilComplete={false}
        initialFields={{ phone: '512-555-0142' }}
        onSubmit={onSubmit}
        uploadPhoto={async () => ({ ok: true })}
      />
    )
    expect(within(screen.getByTestId('field-phone')).getByRole('textbox')).toHaveValue('512-555-0142')
    fireEvent.submit(screen.getByTestId('details-form-claim'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].fields.phone).toBe('512-555-0142')
  })
})

describe('Vera QA regressions (Sep 27)', () => {
  it('#7 Undo puts a service back to the state it had before Remove (Keep -> Keep, unanswered -> unanswered)', () => {
    renderForm()
    const row = (name: string) => screen.getByTestId(`service-${name}`)
    const keepPressed = (name: string) => within(row(name)).getByRole('button', { name: 'Keep' }).getAttribute('aria-pressed')
    // Kept, removed, undone: Keep again.
    fireEvent.click(within(row('Lawn mowing')).getByRole('button', { name: 'Keep' }))
    fireEvent.click(within(row('Lawn mowing')).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(row('Lawn mowing')).getByRole('button', { name: 'Undo' }))
    expect(keepPressed('Lawn mowing')).toBe('true')
    // Unanswered, removed, undone: unanswered again.
    fireEvent.click(within(row('Bush trimming')).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(row('Bush trimming')).getByRole('button', { name: 'Undo' }))
    expect(keepPressed('Bush trimming')).toBe('false')
  })

  it('#6 every text box on the details form is at least 44px tall', () => {
    renderForm()
    for (const key of ['phone', 'address', 'quote_email']) {
      const box = within(screen.getByTestId(`field-${key}`)).getByRole('textbox')
      expect(box.className).toContain('min-h-[44px]')
    }
    expect(screen.getByLabelText('Add a service').className).toContain('min-h-[44px]')
  })
})

describe('round 4: only answered fields are sent or shown as confirmed (Vera r2 bug 2)', () => {
  function renderMode(mode: 'preview' | 'claim', onSubmit = vi.fn(async (p: DetailsPayload) => ({ ok: true as const, submissionId: String(!!p) })), initialFields?: Record<string, string>) {
    render(
      <DetailsForm
        mode={mode}
        prefill={prefill}
        services={services}
        submitLabel={mode === 'preview' ? SEND_DETAILS_LABEL : 'Confirm details'}
        successText="Thanks"
        lockUntilComplete={mode === 'claim'}
        initialFields={initialFields}
        onSubmit={onSubmit}
        uploadPhoto={async () => ({ ok: true })}
      />
    )
    return onSubmit
  }

  it('preview: sending only a phone leaves the Thumbtack hours and service area out', async () => {
    const onSubmit = renderMode('preview')
    fireEvent.change(within(screen.getByTestId('field-phone')).getByRole('textbox'), { target: { value: '512 555 0142' } })
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = (onSubmit.mock.calls[0] as unknown as [DetailsPayload])[0]
    expect(payload.fields).toEqual({ phone: '512-555-0142' })
  })

  it('preview: "Looks right" hours are sent, untouched service area is not', async () => {
    const onSubmit = renderMode('preview')
    fireEvent.click(within(screen.getByTestId('field-hours')).getByRole('button', { name: 'Looks right' }))
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = (onSubmit.mock.calls[0] as unknown as [DetailsPayload])[0]
    expect(payload.fields).toEqual({ hours: 'Sun–Sat 8:00 am – 6:00 pm' })
  })

  it('claim step 2 after a phone-only preview: hours and service area still need "Looks right"', () => {
    renderMode('claim', undefined, { phone: '512-555-0142' })
    for (const key of ['hours', 'service_area']) {
      const row = screen.getByTestId(`field-${key}`)
      expect(within(row).getByRole('button', { name: 'Looks right' })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByRole('button', { name: 'Confirm details' })).toBeDisabled()
  })
})

describe('round 4: Edit selects the value and phones are checked (Vera r2 bug 3)', () => {
  function renderPreview(onSubmit = vi.fn(async (p: DetailsPayload) => ({ ok: true as const, submissionId: String(!!p) }))) {
    render(
      <DetailsForm
        mode="preview"
        prefill={{ ...prefill, phone: { value: '5125550100', source: 'Thumbtack profile' } }}
        services={services}
        submitLabel={SEND_DETAILS_LABEL}
        successText="Thanks"
        lockUntilComplete={false}
        onSubmit={onSubmit}
        uploadPhoto={async () => ({ ok: true })}
      />
    )
    return onSubmit
  }

  it('Edit focuses the box and selects its whole value', () => {
    renderPreview()
    fireEvent.click(within(screen.getByTestId('field-hours')).getByRole('button', { name: 'Edit' }))
    const box = within(screen.getByTestId('field-hours')).getByRole('textbox') as HTMLTextAreaElement
    expect(box).toHaveFocus()
    expect(box.selectionStart).toBe(0)
    expect(box.selectionEnd).toBe(box.value.length)
  })

  it('a pre-filled phone shows as 512-555-0100', () => {
    renderPreview()
    expect(screen.getByTestId('value-phone')).toHaveTextContent('512-555-0100')
  })

  it('a 7-digit phone shows the exact error and is not sent', async () => {
    const onSubmit = renderPreview()
    fireEvent.click(within(screen.getByTestId('field-phone')).getByRole('button', { name: 'Edit' }))
    const box = within(screen.getByTestId('field-phone')).getByRole('textbox')
    fireEvent.change(box, { target: { value: '555-0142' } })
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    expect(await screen.findByTestId('error-phone')).toHaveTextContent('Please enter a 10-digit phone number, including the area code.')
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
    // Fixing it clears the error.
    fireEvent.change(box, { target: { value: '(512) 555.0142' } })
    expect(screen.queryByTestId('error-phone')).toBeNull()
  })

  it('"(512) 555.0142" is shown after leaving the box and sent as 512-555-0142', async () => {
    const onSubmit = renderPreview()
    fireEvent.click(within(screen.getByTestId('field-phone')).getByRole('button', { name: 'Edit' }))
    const box = within(screen.getByTestId('field-phone')).getByRole('textbox')
    fireEvent.change(box, { target: { value: '(512) 555.0142' } })
    fireEvent.blur(box)
    expect(box).toHaveValue('512-555-0142')
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect((onSubmit.mock.calls[0] as unknown as [DetailsPayload])[0].fields.phone).toBe('512-555-0142')
  })

  it('the green check is hidden while the phone has an error and comes back once the number is valid (Lina gap 2)', async () => {
    renderPreview()
    const row = () => screen.getByTestId('field-phone')
    fireEvent.click(within(row()).getByRole('button', { name: 'Edit' }))
    const box = within(row()).getByRole('textbox')
    fireEvent.change(box, { target: { value: '512-555-0199' } })
    expect(within(row()).getByTestId('check-phone')).toBeInTheDocument()
    fireEvent.change(box, { target: { value: '555-0142' } })
    fireEvent.blur(box)
    expect(await within(row()).findByTestId('error-phone')).toBeInTheDocument()
    expect(within(row()).queryByTestId('check-phone')).toBeNull()
    // Sending with the error still there: error, no check.
    fireEvent.click(screen.getByRole('button', { name: SEND_DETAILS_LABEL }))
    expect(await within(row()).findByTestId('error-phone')).toBeInTheDocument()
    expect(within(row()).queryByTestId('check-phone')).toBeNull()
    // Typing a still-incomplete number: no check yet.
    fireEvent.change(box, { target: { value: '512-555-01' } })
    expect(within(row()).queryByTestId('check-phone')).toBeNull()
    // Valid again: the check is back, no error.
    fireEvent.change(box, { target: { value: '(512) 555.0142' } })
    fireEvent.blur(box)
    expect(within(row()).queryByTestId('error-phone')).toBeNull()
    expect(within(row()).getByTestId('check-phone')).toBeInTheDocument()
  })

  it('leaving the box with a bad number shows the error right away', async () => {
    renderPreview()
    fireEvent.click(within(screen.getByTestId('field-phone')).getByRole('button', { name: 'Edit' }))
    const box = within(screen.getByTestId('field-phone')).getByRole('textbox')
    fireEvent.change(box, { target: { value: 'call me' } })
    fireEvent.blur(box)
    expect(await screen.findByTestId('error-phone')).toHaveTextContent('Please enter a 10-digit phone number, including the area code.')
  })
})
