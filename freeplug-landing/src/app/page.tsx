import { Suspense } from 'react'
import {
  Navigation,
  HeroSection,
  AboutSection,
  TechStackSection,
  ReviewsSection,
  HostingPlansSection,
  CTASection,
  Footer,
} from '@/features/landing'

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <HeroSection />
        <AboutSection />
        <TechStackSection />
        <ReviewsSection />
        <Suspense fallback={<div className="py-24 bg-zinc-50 min-h-[240px] border-y border-zinc-200/80" />}>
          <HostingPlansSection />
        </Suspense>
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
