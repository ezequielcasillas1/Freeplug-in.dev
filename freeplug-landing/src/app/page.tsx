import {
  Navigation,
  HeroSection,
  AboutSection,
  TechStackSection,
  ReviewsSection,
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
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
