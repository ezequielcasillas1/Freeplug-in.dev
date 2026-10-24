import {
  Navigation,
  HeroSection,
  AboutSection,
  OutreachSection,
  CTASection,
  TechStackSection,
  ReviewsSection,
  Footer,
} from '@/features/landing'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { OfferingsSection } from '@/features/landing/components/OfferingsSection'
import { TemplatesSection } from '@/features/landing/components/TemplatesSection'
import { HostingPlansSectionUi } from '@/features/landing/components/HostingPlansSectionUi'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.meta' })
  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    ...publicAlternates('/', locale),
    openGraph: { title: t('ogTitle'), description: t('ogDescription'), type: 'website', ...ogLocale(locale) },
    twitter: { card: 'summary', title: t('ogTitle'), description: t('ogDescription') },
  }
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale(toAppLocale((await params).locale)) // keeps / and /es static
  return (
    <>
      <Navigation />
      <main>
        {/* Lina order: Hero → What Freeplug does → TX → Outside US → How it works → Closing CTA */}
        <HeroSection />
        {/* What we build (Oct 22): right after the hero */}
        <OfferingsSection />
        {/* TEST-ONLY Envato template tree (Oct 23), not deployed */}
        <TemplatesSection />
        <AboutSection />
        <OutreachSection />
        <CTASection />
        <TechStackSection />
        {/* Public plans block (no Supabase) so #hosting-plans nav/footer links resolve */}
        <HostingPlansSectionUi signedIn={false} hostingCheckoutAllowed={false} />
        <ReviewsSection />
      </main>
      <Footer />
    </>
  )
}
