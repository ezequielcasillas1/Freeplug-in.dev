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
import { HostingPlansSectionUi } from '@/features/landing/components/HostingPlansSectionUi'

export const metadata: Metadata = {
  title: 'Free Websites for Local Businesses in Central Texas | Freeplug',
  description:
    'Freeplug helps local business owners get a website. 72 After builds it for free. Serving San Marcos, Kyle, New Braunfels, San Antonio and Austin.',
  openGraph: {
    title: 'Free Websites for Local Businesses | Freeplug',
    description: 'Local business without a website? Request one. 72 After builds it for free.',
    type: 'website',
  },
}

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        {/* Lina order: Hero → What Freeplug does → TX → Outside US → How it works → Closing CTA */}
        <HeroSection />
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
