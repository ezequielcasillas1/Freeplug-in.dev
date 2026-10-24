import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setTestLocale } from '../../../../test/intl-mock'
import { TemplatesSection } from './TemplatesSection'
import { ENVATO_TEMPLATES, visibleTemplateTree } from '@/lib/templates/template-tree'

afterEach(() => setTestLocale('en'))

const desktop = () => screen.getByTestId('templates-categories').parentElement as HTMLElement

describe('TemplatesSection (Envato template tree, test-only)', () => {
  it('data: 76 templates, 6 categories', () => {
    expect(ENVATO_TEMPLATES).toHaveLength(76)
    expect(visibleTemplateTree()).toHaveLength(6)
  })
  it('hides niches with zero templates', () => {
    const tree = visibleTemplateTree(
      [{ id: 'a', label_en: 'A', label_es: 'A', niches: [{ id: 'x', label_en: 'X', label_es: 'X' }, { id: 'empty', label_en: 'E', label_es: 'E' }] }],
      [{ ...ENVATO_TEMPLATES[0], category: 'a', niche: 'x' }],
    )
    expect(tree[0].niches.map((n) => n.id)).toEqual(['x'])
  })
  it('category then niche selection shows that niche’s cards', () => {
    render(<TemplatesSection />)
    fireEvent.click(within(desktop()).getByRole('button', { name: 'Local businesses' }))
    fireEvent.click(within(screen.getByTestId('templates-niches')).getByRole('button', { name: 'Contractors' }))
    expect(within(screen.getByTestId('templates-grid')).getAllByRole('listitem')).toHaveLength(9)
    fireEvent.click(within(desktop()).getByRole('button', { name: 'SaaS & web apps' }))
    expect(within(screen.getByTestId('templates-grid')).getAllByRole('listitem')).toHaveLength(3)
  })
  it('every demo link opens in a new tab with noopener noreferrer, and nothing is embedded', () => {
    const { container } = render(<TemplatesSection />)
    for (const c of visibleTemplateTree()) {
      fireEvent.click(within(desktop()).getByRole('button', { name: c.label_en }))
      const links = within(screen.getByTestId('templates-grid')).getAllByRole('link')
      for (const a of links) {
        expect(a.getAttribute('target')).toBe('_blank')
        expect(a.getAttribute('rel')).toBe('noopener noreferrer')
      }
    }
    expect(container.querySelector('iframe, embed, object')).toBeNull()
  })
  it('phone list is closed until tapped, then picking a niche closes it', () => {
    render(<TemplatesSection />)
    const m = screen.getByTestId('templates-mobile')
    const toggle = within(m).getAllByRole('button')[0]
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(m).queryByRole('list')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(m).getByRole('button', { name: 'Podcasts' }))
    expect(within(m).queryByRole('list')).toBeNull()
    expect(screen.getByTestId('template-podcasts-podwave')).toBeTruthy()
  })
  it('Spanish labels', () => {
    setTestLocale('es')
    render(<TemplatesSection />)
    expect(screen.getByRole('heading', { level: 2, name: 'Empieza con una plantilla' })).toBeTruthy()
    expect(within(desktop()).getByRole('button', { name: 'Negocios locales' })).toBeTruthy()
  })
})
