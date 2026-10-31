import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setTestLocale } from '../../../test/intl-mock'
import { CompareTable } from './CompareTable'
import { COMPARE_ROWS } from '@/lib/compare/data'

afterEach(() => setTestLocale('en'))

describe('CompareTable', () => {
  it('renders every company in the table and the cards, Freeplug first', () => {
    const { container } = render(<CompareTable />)
    const rows = [...container.querySelectorAll('tr[data-company]')].map((r) => r.getAttribute('data-company'))
    expect(rows).toEqual(COMPARE_ROWS.map((r) => r.id))
    expect(container.querySelectorAll('[data-company-card]')).toHaveLength(COMPARE_ROWS.length)
    expect(screen.getAllByText('Payments count toward owning it?').length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/best|#1/i)
  })
  it('source links are nofollow, new tab; Not stated in gray italic', () => {
    const { container } = render(<CompareTable />)
    const wix = container.querySelector('a[href="https://www.wix.com/plans"]')!
    expect(wix.getAttribute('rel')).toBe('nofollow noopener')
    expect(wix.getAttribute('target')).toBe('_blank')
    const ns = [...container.querySelectorAll('span.italic')]
    expect(ns.length).toBeGreaterThan(0)
    expect(ns[0].textContent).toBe('Not stated')
  })
  it('Grippy ownership cell links to its FAQ; San Marcos is One-time purchase; group label', () => {
    const { container } = render(<CompareTable />)
    const a = container.querySelector('a[data-testid="counts-source-grippyCode"]')!
    expect(a.getAttribute('href')).toBe('https://grippycode.com/faq')
    expect(a.getAttribute('rel')).toBe('nofollow noopener')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.textContent).toContain('No, per their site')
    expect(container.querySelector('tr[data-company="sanMarcos"]')!.textContent).toContain('One-time purchase')
    expect(container.textContent).toContain('Monthly website services')
    expect(container.textContent).not.toContain('Rent-to-own')
  })
  it('home short version: Freeplug + rent-to-own only', () => {
    const { container } = render(<CompareTable groups={['freeplug', 'rentToOwn']} />)
    expect([...container.querySelectorAll('tr[data-company]')].map((r) => r.getAttribute('data-company'))).toEqual(['freeplug', 'rwMedia', 'grippyCode', 'leaseReady', 'payPerMonth'])
  })
  it('Spanish', () => {
    vi.stubEnv('FREEPLUG_I18N_ES_ALLOW_PENDING', '1')
    setTestLocale('es')
    const { container } = render(<CompareTable />)
    expect(container.textContent).toContain('¿Los pagos cuentan para que sea tuyo?')
    expect(container.textContent).toContain('No se indica')
    expect(container.textContent).toContain('Lo haces tú')
    vi.unstubAllEnvs()
  })
})
