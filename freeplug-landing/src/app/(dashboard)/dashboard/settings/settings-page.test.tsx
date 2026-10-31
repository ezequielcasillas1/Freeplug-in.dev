import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../../../messages/en.json'

vi.mock('next-intl/server', () => ({
  getTranslations: async (ns: string) => (key: string) => {
    let v: unknown = en
    for (const k of `${ns}.${key}`.split('.')) v = (v as Record<string, unknown>)[k]
    return v as string
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'quinn@example.test' } } }) } }),
}))
vi.mock('@/components/i18n/LanguageSelect', () => ({ LanguageSelect: () => <div>language-select</div> }))
const gate = vi.hoisted(() => ({ on: false }))
vi.mock('@/i18n/gate', async (orig) => ({ ...(await orig<typeof import('@/i18n/gate')>()), spanishEnabled: () => gate.on }))

import SettingsPage from './page'

describe('Settings page (Oct 30: was blank with the Spanish gate off)', () => {
  it('gate off: shows the account section (email + help link), no language row', async () => {
    gate.on = false
    render(await SettingsPage())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Account')
    expect(screen.getByText('quinn@example.test')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Help center' }).getAttribute('href')).toBe('/dashboard/help')
    expect(screen.queryByText('language-select')).toBeNull()
  })

  it('gate on: account section plus the language row', async () => {
    gate.on = true
    render(await SettingsPage())
    expect(screen.getByText('quinn@example.test')).toBeTruthy()
    expect(screen.getByText('language-select')).toBeTruthy()
  })
})
