import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

import { Picker, type PickerItem } from './Picker'
import { TypeStep } from './TypeStep'

const items: PickerItem[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Clean ${i + 1}`, thumb: `https://img/${i}.jpg`, preview: `https://demo/${i}`, available: i !== 5 }))
const base = { lang: 'en' as const, requestId: '00000000-0000-4000-8000-00000000c0de', type: 'cleaning' as const, typeSaved: false, changeTypeHref: '/x?step=type', items, initial: null }

describe('Picker', () => {
  it('shows each template once, 4:3 lazy thumbs with alt text, and disables unavailable', () => {
    render(<Picker {...base} save={vi.fn()} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    const img = screen.getByAltText('Preview of the Clean 1 template')
    expect(img.getAttribute('loading')).toBe('lazy')
    const last = screen.getByTestId('card-6')
    expect(within(last).getByTestId('unavailable')).toBeTruthy()
    expect((within(last).getByRole('button', { name: 'Choose this one' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(screen.getByTestId('card-1')).getByRole('link', { name: /Preview/ }).getAttribute('target')).toBe('_blank')
  })

  it('keeps one selection across option cards and grid', () => {
    render(<Picker {...base} save={vi.fn()} />)
    fireEvent.click(within(screen.getByTestId('card-2')).getByRole('button', { name: 'Choose this one' }))
    expect(within(screen.getByTestId('card-2')).getByRole('button', { name: 'Selected' })).toBeTruthy()
    expect(screen.getAllByTestId('selected-badge')).toHaveLength(1)
    fireEvent.click(within(screen.getByTestId('option-team')).getByRole('button', { name: 'Choose this one' }))
    expect(screen.getAllByTestId('selected-badge')).toHaveLength(1)
    expect(within(screen.getByTestId('card-2')).queryByRole('button', { name: 'Selected' })).toBeNull()
    expect(screen.getByTestId('confirm-bar').textContent).toContain('Let 72 After pick for me')
  })

  it('paste: bad link shows the error under the input and keeps the text', () => {
    render(<Picker {...base} save={vi.fn()} />)
    fireEvent.click(within(screen.getByTestId('option-paste')).getByRole('button', { name: 'Template link' }))
    const input = screen.getByLabelText('Template link') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this link' }))
    expect(screen.getByRole('alert').textContent).toContain('https://themeforest.net/item/')
    expect(input.value).toBe('https://example.com/x')
    expect(screen.queryByTestId('confirm-bar')).toBeNull()
    fireEvent.change(input, { target: { value: 'https://themeforest.net/item/a/1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this link' }))
    expect(screen.getByTestId('confirm-bar')).toBeTruthy()
  })

  it('paste: a 501-char link is not truncated; it shows the existing error and is not selected (Vera Low)', () => {
    const save = vi.fn()
    render(<Picker {...base} save={save} />)
    fireEvent.click(within(screen.getByTestId('option-paste')).getByRole('button', { name: 'Template link' }))
    const input = screen.getByLabelText('Template link') as HTMLInputElement
    expect(input.hasAttribute('maxlength')).toBe(false)
    const prefix = 'https://themeforest.net/item/a/'
    const long = prefix + '1'.repeat(501 - prefix.length)
    expect(long).toHaveLength(501)
    fireEvent.change(input, { target: { value: long } })
    expect(input.value).toBe(long)
    fireEvent.click(screen.getByRole('button', { name: 'Use this link' }))
    expect(screen.getByRole('alert').textContent).toBe('Please paste a link that starts with https://themeforest.net/item/')
    expect(screen.queryByTestId('confirm-bar')).toBeNull()
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: long.slice(0, 500) } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this link' }))
    expect(screen.getByTestId('confirm-bar')).toBeTruthy()
  })

  it('confirm screen saves with the business type; save error keeps the selection', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false, error: 'stale' }).mockResolvedValueOnce({ ok: true })
    render(<Picker {...base} save={save} />)
    fireEvent.click(within(screen.getByTestId('card-1')).getByRole('button', { name: 'Choose this one' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByTestId('confirm-screen').textContent).toContain('Use Clean 1 for your site?')
    fireEvent.click(screen.getByRole('button', { name: 'Yes, use this template' }))
    await waitFor(() => expect(screen.getByTestId('save-error').textContent).toContain("isn't available anymore"))
    expect(save).toHaveBeenCalledWith(base.requestId, { choice: 'envato_catalog', envatoItemId: 1, businessType: 'cleaning' })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, use this template' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/request-website?picked=1'))
  })

  it('restores a saved pick (persists after refresh) and always shows Change business type', () => {
    render(<Picker {...base} initial={{ kind: 'item', id: 3 }} save={vi.fn()} />)
    expect(within(screen.getByTestId('card-3')).getByRole('button', { name: 'Selected' })).toBeTruthy()
    expect(screen.getByText('Change business type').getAttribute('href')).toBe('/x?step=type')
  })

  it('type-cleared: neutral banner under the chip, stays while they choose again', () => {
    render(<Picker {...base} repick save={vi.fn()} />)
    const b = screen.getByTestId('type-cleared')
    expect(b.textContent).toBe('Your business type changed, so please choose a template again.')
    expect(b.className).not.toMatch(/red/)
    expect(b.previousElementSibling?.querySelector('[data-testid=type-chip]')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('card-1')).getByRole('button', { name: 'Choose this one' }))
    expect(screen.getByTestId('type-cleared')).toBeTruthy()
  })

  it('shows 12 cards, then Show more adds 12 per tap (aria: 12 more / more)', () => {
    const many: PickerItem[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, thumb: null, preview: null, available: true }))
    render(<Picker {...base} items={many} save={vi.fn()} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(12)
    const more = screen.getByTestId('show-more')
    expect(more.textContent).toBe('Show more')
    expect(more.getAttribute('aria-label')).toBe('Show 12 more templates')
    expect(more.className).toContain('w-full')
    fireEvent.click(more)
    expect(screen.getAllByRole('listitem')).toHaveLength(24)
    expect(screen.getByTestId('show-more').getAttribute('aria-label')).toBe('Show more templates')
    fireEvent.click(screen.getByTestId('show-more'))
    expect(screen.getAllByRole('listitem')).toHaveLength(30)
    expect(screen.queryByTestId('show-more')).toBeNull()
  })

  it('no Show more at 12; a restored pick past page 1 stays visible; bar padding stays below the button', () => {
    const many: PickerItem[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, thumb: null, preview: null, available: true }))
    const { unmount } = render(<Picker {...base} items={many.slice(0, 12)} save={vi.fn()} />)
    expect(screen.queryByTestId('show-more')).toBeNull()
    unmount()
    render(<Picker {...base} items={many} initial={{ kind: 'item', id: 20 }} save={vi.fn()} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(24)
    expect(within(screen.getByTestId('card-20')).getByRole('button', { name: 'Selected' })).toBeTruthy()
    expect(screen.getByTestId('picker').className).toContain('pb-24')
    expect(screen.getByTestId('picker').contains(screen.getByTestId('show-more'))).toBe(true)
  })

  it('Spanish show-more strings', () => {
    const many: PickerItem[] = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, thumb: null, preview: null, available: true }))
    render(<Picker {...base} lang="es" items={many} save={vi.fn()} />)
    expect(screen.getByTestId('show-more').textContent).toBe('Ver más')
    expect(screen.getByTestId('show-more').getAttribute('aria-label')).toBe('Ver más plantillas')
  })

  it('empty state', () => {
    render(<Picker {...base} items={[]} save={vi.fn()} />)
    expect(screen.getByTestId('empty').textContent).toContain('No templates for this business type yet')
    expect(screen.getByTestId('option-team')).toBeTruthy()
  })
})

describe('TypeStep', () => {
  it('20 tiles, Cleaning first, other_local last, Continue disabled until chosen', () => {
    render(<TypeStep lang="en" basePath="/p" initial={null} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(20)
    expect(radios[0].value).toBe('cleaning')
    expect(radios[19].value).toBe('other_local')
    const btn = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(radios[0])
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(push).toHaveBeenCalledWith('/p?type=cleaning')
  })
})

describe('TypeStep change mode (type already saved)', () => {
  it('saves the new type and goes back to the grid with repick when the pick was cleared', async () => {
    push.mockClear()
    const save = vi.fn().mockResolvedValue({ ok: true, cleared: true })
    render(<TypeStep lang="en" basePath="/p" initial="cleaning" change={{ requestId: 'rid', save }} />)
    fireEvent.click(screen.getByDisplayValue('dental'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/p?repick=1'))
    expect(save).toHaveBeenCalledWith('rid', 'dental')
  })
  it('shows the locked line when the server refuses', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: 'locked' })
    render(<TypeStep lang="en" basePath="/p" initial="cleaning" change={{ requestId: 'rid', save }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByTestId('type-save-error').textContent).toContain('support@freeplug-in.dev'))
  })
})

describe('Picker fix round', () => {
  const many: PickerItem[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `T ${i + 1}`, thumb: null, preview: null, available: true }))
  it('Show more moves focus to the first new card, uses the .rest aria under 12 left, and hides at the end', async () => {
    render(<Picker {...base} items={many} save={vi.fn()} />)
    const btn = screen.getByTestId('show-more')
    expect(btn.getAttribute('aria-label')).toBe('Show 12 more templates')
    fireEvent.click(btn)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('card-13')))
    expect(screen.getByTestId('show-more').getAttribute('aria-label')).toBe('Show more templates')
    fireEvent.click(screen.getByTestId('show-more'))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('card-25')))
    expect(screen.queryByTestId('show-more')).toBeNull()
  })
  it('M1: general cards carry the General tag and the widen id goes with a catalog pick', async () => {
    const save = vi.fn(async () => ({ ok: true as const }))
    const mixed: PickerItem[] = [{ ...items[0] }, { id: 50, name: 'Gen', thumb: null, preview: null, available: true, general: true }]
    render(<Picker {...base} items={mixed} widenLogId={7} save={save} />)
    expect(within(screen.getByTestId('card-1')).queryByTestId('general-tag')).toBeNull()
    const tag = within(screen.getByTestId('card-50')).getByTestId('general-tag')
    expect(tag.textContent).toBe('General')
    expect(tag.getAttribute('aria-label')).toBe('General template, not made for one type of business')
    fireEvent.click(within(screen.getByTestId('card-50')).getByRole('button', { name: 'Choose this one' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, use this template' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(base.requestId, { choice: 'envato_catalog', envatoItemId: 50, businessType: 'cleaning', widenLogId: 7 }))
  })
  it('L2: fixed confirm titles for a pasted link and a team pick', () => {
    const { unmount } = render(<Picker {...base} initial={{ kind: 'paste', url: 'https://themeforest.net/item/x/1' }} save={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByTestId('confirm-title').textContent).toBe('Use the template from your link?')
    unmount()
    render(<Picker {...base} lang="es" initial={{ kind: 'team' }} save={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByTestId('confirm-title').textContent).toBe('¿Dejar que 72 After elija tu plantilla?')
  })
  it('L1: banner renders when repick is true', () => {
    render(<Picker {...base} repick save={vi.fn()} />)
    expect(screen.getByTestId('type-cleared').getAttribute('role')).toBe('status')
  })
})


describe('Picker pick window', () => {
  it('shows the gray countdown under the heading, rounded up', () => {
    render(<Picker {...base} save={vi.fn()} countdownMs={12 * 60_000 + 1} />)
    const cd = screen.getByTestId('pick-countdown')
    expect(cd.textContent).toBe('You can change your template for 13 more minutes.')
    expect(cd.className).toContain('text-gray-500')
    expect(cd.className).not.toMatch(/red/)
  })
  it('at 61 (grace): no countdown, picker still works', () => {
    render(<Picker {...base} save={vi.fn()} countdownMs={null} />)
    expect(screen.queryByTestId('pick-countdown')).toBeNull()
    fireEvent.click(within(screen.getByTestId('card-2')).getByRole('button', { name: 'Choose this one' }))
    expect(screen.getByTestId('confirm-bar')).toBeTruthy()
  })
  it("server says closed: straight to read-only, only the chosen card + Selected tag + note + link", async () => {
    const save = vi.fn(async () => ({ ok: false as const, error: 'locked' as const }))
    render(<Picker {...base} lang="es" initial={{ kind: 'item', id: 2 }} save={save} />)
    fireEvent.click(within(screen.getByTestId('card-3')).getByRole('button', { name: 'Elegir esta' }))
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, usar esta plantilla' }))
    await waitFor(() => expect(screen.getByTestId('picker-readonly')).toBeTruthy())
    expect(screen.queryByTestId('grid')).toBeNull()
    expect(screen.getByTestId('readonly-card').textContent).toContain('Clean 2')
    expect(screen.getByTestId('selected-tag').textContent).toBe('Seleccionada')
    expect(screen.getByTestId('readonly-note').textContent).toBe('Tu plantilla ya está elegida. ¿Quieres otra? Envíanos una solicitud de cambio.')
    const link = screen.getByTestId('change-request-link')
    expect(link.textContent).toBe('Pedir un cambio')
    expect(link.getAttribute('href')).toBe(`mailto:support@freeplug-in.dev?subject=Cambio%20de%20plantilla%2C%20solicitud%20${base.requestId}`)
    expect(link.className).toMatch(/min-h-\[44px\].*w-full/)
  })
})
