/**
 * Dashboard language switch (Lina/Sable final spec, Oct 10). Gate on for this file only.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES = 'on'
  process.env.FREEPLUG_I18N_ES_ALLOW_PENDING = '1'
})

const save = vi.fn(async (l: string) => ({ ok: true as const, locale: l, savedToAccount: true }))
const refresh = vi.fn()
let pathname = '/dashboard'
vi.mock('@/app/language-actions', () => ({ saveLocalePreference: (l: string) => save(l) }))
vi.mock('@/app/(auth)/actions', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const { setTestLocale } = await import('../../../test/intl-mock')
const { DashboardHeader } = await import('./DashboardHeader')
const { DashboardFooter } = await import('./DashboardFooter')
const { LanguageSelect } = await import('@/components/i18n/LanguageSelect')

function wrap(locale: 'en' | 'es', ui: React.ReactNode) {
  setTestLocale(locale)
  return <>{ui}</>
}

beforeEach(() => {
  save.mockClear()
  refresh.mockClear()
  pathname = '/dashboard'
})

describe('header link', () => {
  it('EN page shows "Español" (lang=es), no flag, just left of the account controls; click saves es', async () => {
    render(wrap('en', <DashboardHeader email="a@example.test" />))
    const link = screen.getByTestId('language-toggle')
    expect(link.textContent).toBe('Español')
    expect(link).toHaveAttribute('lang', 'es')
    expect(link.querySelector('img,svg')).toBeNull()
    expect(link.className).toContain('whitespace-nowrap')
    expect(link.className).not.toContain('truncate')
    expect(link.nextElementSibling).toBe(screen.getByTestId('account-menu'))
    await act(async () => fireEvent.click(link))
    expect(save).toHaveBeenCalledWith('es')
    expect(refresh).toHaveBeenCalled()
  })
  it('ES page shows "English" and switches back', async () => {
    render(wrap('es', <DashboardHeader email="a@example.test" />))
    const link = screen.getByTestId('language-toggle')
    expect(link.textContent).toBe('English')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    await act(async () => fireEvent.click(link))
    expect(save).toHaveBeenCalledWith('en')
  })
  it("'menu' placement makes it the first item of the account menu", () => {
    render(wrap('en', <DashboardHeader email="a@example.test" pickerPlacement="menu" />))
    expect(screen.getByTestId('account-menu').firstElementChild).toBe(screen.getByTestId('language-toggle'))
  })
  it('a failed account save does not re-render (cookie and profile stay as they were)', async () => {
    save.mockResolvedValueOnce({ ok: false, code: 'save_failed' } as never)
    render(wrap('en', <DashboardHeader email="a@example.test" />))
    await act(async () => fireEvent.click(screen.getByTestId('language-toggle')))
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('settings row', () => {
  it('EN: "Language" select with English/Español, saves on change, shows gray "Saved", no Save button', async () => {
    render(wrap('en', <LanguageSelect />))
    const select = screen.getByLabelText('Language') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['English', 'Español'])
    expect(select.value).toBe('en')
    expect(screen.queryByRole('button')).toBeNull()
    await act(async () => fireEvent.change(select, { target: { value: 'es' } }))
    expect(save).toHaveBeenCalledWith('es')
    expect(screen.getByTestId('language-saved').textContent).toBe('Saved')
    expect(screen.getByTestId('language-saved').className).toContain('text-gray-500')
  })
  it('ES: "Idioma" and "Guardado" (Sable drafts, pending)', async () => {
    render(wrap('es', <LanguageSelect />))
    const select = screen.getByLabelText(/Idioma|Language/) as HTMLSelectElement
    expect(select.value).toBe('es')
    await act(async () => fireEvent.change(select, { target: { value: 'en' } }))
    expect(save).toHaveBeenCalledWith('en')
  })
})

describe('legal line in the Spanish dashboard', () => {
  it('appears once in the footer in es, never in en, never on /dashboard/plans', () => {
    const { unmount } = render(wrap('es', <DashboardFooter />))
    expect(screen.getAllByTestId('translation-notice')).toHaveLength(1)
    expect(screen.getByTestId('translation-notice').textContent).toBe('Traducción para tu conveniencia; la versión en inglés prevalece.')
    unmount()
    render(wrap('en', <DashboardFooter />))
    expect(screen.queryByTestId('translation-notice')).toBeNull()
  })
  it('hidden on checkout', () => {
    pathname = '/dashboard/plans'
    render(wrap('es', <DashboardFooter />))
    expect(screen.queryByTestId('translation-notice')).toBeNull()
  })
  it('the dashboard layout renders the footer exactly once', () => {
    const src = readFileSync(join(__dirname, 'layout.tsx'), 'utf8')
    expect(src.match(/<DashboardFooter/g)).toHaveLength(1)
    expect(src).not.toContain('<TranslationNotice')
  })
})
