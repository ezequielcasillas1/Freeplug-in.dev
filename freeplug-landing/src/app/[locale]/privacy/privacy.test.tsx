/** Privacy policy (Oct 24 2026): renders in EN and ES, and never names a vendor brand. */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { buildSitemap } from '@/app/sitemap'

const CATALOGS = { en, es } as Record<string, unknown>
const get = (obj: unknown, path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj)

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const base = get(CATALOGS[locale], namespace)
    const t = (k: string) => get(base, k) as string
    t.raw = (k: string) => get(base, k)
    // Minimal t.rich: supports <tag>chunks</tag> via the passed render functions.
    t.rich = (k: string, tags: Record<string, (c: string) => unknown>) => {
      const parts: unknown[] = []
      const re = /<(\w+)>(.*?)<\/\1>/g
      const s = get(base, k) as string
      let last = 0
      for (let m; (m = re.exec(s)); last = re.lastIndex) {
        parts.push(s.slice(last, m.index), tags[m[1]](m[2]))
      }
      parts.push(s.slice(last))
      return parts
    }
    return t
  },
}))
vi.mock('@/features/landing/components/Navigation', () => ({ Navigation: () => null }))
vi.mock('@/features/landing/components/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/i18n/TranslationNotice', () => ({ TranslationNotice: () => null }))

const BRANDS = /cloudflare|supabase|stripe|resend|turnstile|cal\.com|calcom|vercel|namecheap|hetzner|thumbtack|gmail|openai|anthropic/i

describe('privacy policy page', () => {
  for (const locale of ['en', 'es'] as const) {
    it(`renders in ${locale} with no postal address, contact and every section, naming no vendor brands`, async () => {
      const { default: PrivacyPage } = await import('./page')
      const html = renderToStaticMarkup(await PrivacyPage({ params: Promise.resolve({ locale }) }))
      // Oct 31 (Cheke): street address must not be disclosed.
      expect(html).not.toMatch(/Staples|3108|78666/)
      expect(html).toMatch(locale === 'en' ? /based in Central Texas, United States\./ : /con sede en el centro de Texas, Estados Unidos\./)
      expect(html).toMatch(locale === 'en' ? /\(a 72 After service\), Central Texas\. Email:/ : /\(un servicio de 72 After\), centro de Texas\. Correo:/)
      expect(html.match(/support@freeplug-in\.dev/g)?.length).toBeGreaterThanOrEqual(3) // intro, yourRights, contact (owner, Oct 31: support@ only)
      // Each occurrence is a clickable mailto link; no raw tags leak.
      expect(html.match(/href="mailto:support@freeplug-in\.dev"/g)?.length).toBe(3)
      expect(html).not.toMatch(/&lt;email|<email/)
      expect(html).not.toContain('legal@')
      expect(html).not.toMatch(/discover@|clients@freeplug-in\.dev/)
      expect(html).toMatch(/72 After/)
      expect(html).toMatch(locale === 'en' ? /October 24, 2026/ : /24 de octubre de 2026/)
      expect(html.match(/<h2/g)?.length).toBe(12) // + "Websites we don't build" (Oct 30)
      expect(html).toMatch(locale === 'en' ? /Websites we don(&#x27;|')t build/ : /Sitios web que no construimos/)
      expect(html).toMatch(/HIPAA/)
      // Oct 30 (Cheke, 9:16 PM CT): adults 18+ only; no '13' age rule left.
      expect(html).toMatch(locale === 'en' ? /Age requirement/ : /Requisito de edad/)
      expect(html).toMatch(locale === 'en' ? /only for adults 18 and older/ : /solo para adultos de 18 años o más/)
      expect(html).not.toMatch(/under 13|menores de 13/)
      expect(html).not.toMatch(BRANDS)
      expect(JSON.stringify(get(CATALOGS[locale], 'public.privacy'))).not.toMatch(BRANDS)
    })
  }

  it('is in the sitemap in both languages', () => {
    const urls = buildSitemap('on').map((e) => e.url)
    expect(urls).toContain('https://freeplug-in.dev/privacy')
    expect(urls).toContain('https://freeplug-in.dev/es/privacy')
  })
})
