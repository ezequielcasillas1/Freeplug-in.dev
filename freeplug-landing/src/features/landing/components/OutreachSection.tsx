'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Globe2, Handshake, MapPin, MessageCircle, Wrench } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { fadeInUp, staggerContainer, cardVariants } from '../animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

// Photos: Wikimedia Commons (Lina, Oct 12 2026). CC BY / BY-SA need visible credit, so each card shows
// "Photo: {author}, {license}" linked to the license and the Commons page. Full record: public/images/outreach/CREDITS.md
const texasCities = [
  {
    name: 'San Marcos',
    image: '/images/outreach/san-marcos-2026-10.jpg',
    alt: 'The Hays County Courthouse in downtown San Marcos',
    credit: {
      author: 'Billy Hathorn',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Hays_County,_TX,_Courthouse_IMG_4119.JPG',
      cropped: false,
    },
  },
  {
    name: 'Kyle',
    image: '/images/outreach/kyle-2026-10.jpg',
    alt: "The Kyle water tower with the city's name on it",
    credit: {
      author: 'Travis K. Witt',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Kyle_Texas_Water_Tower.JPG',
      cropped: true,
    },
  },
  {
    name: 'New Braunfels',
    image: '/images/outreach/new-braunfels-2026-10.jpg',
    alt: 'Gruene Hall, the historic dance hall in New Braunfels',
    credit: {
      author: 'Larry D. Moore',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Gruene_hall.jpg',
      cropped: true,
    },
  },
  {
    name: 'San Antonio',
    image: '/images/outreach/san-antonio-2026-10.jpg',
    alt: 'The Alamo in downtown San Antonio',
    credit: {
      author: 'Thank You (22.5 Millions+) views',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Alamo_-_52134465867.jpg',
      cropped: true,
    },
  },
  {
    name: 'Austin',
    image: '/images/outreach/austin-2026-10.jpg',
    alt: 'The Austin skyline over Lady Bird Lake',
    credit: {
      author: 'ajay_suresh',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Downtown_Austin_Skyline_-_Lady_Bird_Lake_(54987239041).jpg',
      cropped: true,
    },
  },
] as const // keys under public.landing.outreach.name / .alt

const howItWorks = [
  {
    step: '1',
    icon: MessageCircle,
    title: 'title.freeplugReachesOut',
    description: 'description.contactOwnersWhoNeed',
  },
  {
    step: '2',
    icon: Wrench,
    title: 'title.72AfterBuilds',
    description: 'description.builds72AfterFreeMultiPage',
  },
  {
    step: '3',
    icon: Handshake,
    title: 'title.goLive',
    description: 'description.reviewSiteAddPhone',
  },
] as const // keys under public.landing.outreach

/** DRAFT Spanish (box-translated, for Sable): city photo alts and the credit words. English stays as written above. */
const ES_ALT: Record<string, string> = {
  'San Marcos': 'El Palacio de Justicia del Condado de Hays en el centro de San Marcos',
  Kyle: 'La torre de agua de Kyle con el nombre de la ciudad',
  'New Braunfels': 'Gruene Hall, el histórico salón de baile en New Braunfels',
  'San Antonio': 'El Álamo en el centro de San Antonio',
  Austin: 'El horizonte de Austin sobre el lago Lady Bird',
}
const CREDIT_WORDS = { en: { photo: 'Photo', cropped: ', cropped' }, es: { photo: 'Foto', cropped: ', recortada' } } as const

export function OutreachSection() {
  const t = useTranslations('public.landing.outreach')
  const locale = toAppLocale(useLocale())
  return (
    <>
      {/* Texas metros */}
      <section id="outreach" className="py-24 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-14"
          >
            <motion.span
              variants={fadeInUp}
              className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
            >
              {t('serviceAreas')}
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
            >
              {t.rich('whereWorkTexas', {
                span: (chunks) => (
                  <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">{chunks}</span>
                ),
              })}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-gray-600 max-w-2xl mx-auto"
            >
              {t('wereFocusedCentralTexasFirst')}
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
          >
            {texasCities.map((city) => (
              <motion.div key={city.name} variants={cardVariants}>
                <Card className="h-full overflow-hidden border-0 shadow-lg p-0 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 group">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={city.image}
                      alt={locale === 'es' ? (ES_ALT[city.name] ?? city.alt) : city.alt}
                      // City photos are all 800x600 and sit below the first screen at 375px and desktop:
                      // explicit size (no layout shift; the aspect box sets the shown size) and lazy load.
                      width={800}
                      height={600}
                      loading="lazy"
                      // Served as-is (78-156 KB JPGs): keeps /_next/image off the Cloudflare Images
                      // quota, which is for uploads (Cloudflare port, Oct 3).
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                      <MapPin className="w-4 h-4" />
                      <span className="font-semibold text-lg drop-shadow">{city.name}</span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">
                      <a href={city.credit.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {CREDIT_WORDS[locale === 'es' ? 'es' : 'en'].photo}: {city.credit.author},{' '}
                      </a>
                      <a href={city.credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
                        {city.credit.license}
                      </a>
                      {city.credit.cropped ? CREDIT_WORDS[locale === 'es' ? 'es' : 'en'].cropped : null}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center text-gray-500 text-sm max-w-xl mx-auto"
          >
            {t('moreTexasCitiesCapacityGrows')}
          </motion.p>
        </div>
      </section>

      {/* Outside the U.S. */}
      <section id="service-areas" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="space-y-6"
            >
              <motion.span
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider"
              >
                <Globe2 className="w-4 h-4" />
                {t('international')}
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-bold text-gray-900"
              >
                {t('beyondTexasUs')}
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-lg text-gray-600 leading-relaxed">
                {t('freeplugReachBusinessesOutsideUs')}
              </motion.p>
              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={publicHref('/signup', locale)}
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'shadow-lg shadow-[#ba3d3d]/30'
                  )}
                >
                  {t('requestInternationalOutreach')}
                  <ArrowRight size={18} className="ml-2" />
                </Link>
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-gray-500">
                {t('availabilityVariesRegionPartnerNo')}
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={staggerContainer}
              className="grid grid-cols-2 gap-4"
            >
              {[
                {
                  src: '/images/outreach/international-1.jpg',
                  alt: t('alt.stockPhotoInternationalCity'),
                  label: t('label.internationalSkylineStockPhoto'),
                },
                {
                  src: '/images/outreach/international-2.jpg',
                  alt: t('alt.stockPhotoCitySkyline2'),
                  label: t('label.citySkylineStockPhoto'),
                },
              ].map((img) => (
                <motion.div key={img.src} variants={cardVariants}>
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-lg">
                    <Image
                      src={img.src}
                      alt={img.alt}
                      width={800}
                      height={600}
                      loading="lazy"
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <p className="absolute bottom-3 left-3 right-3 text-white text-xs font-medium drop-shadow">
                      {img.label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works / connects to 72 After */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-14"
          >
            <motion.span
              variants={fadeInUp}
              className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
            >
              {t('howItConnects')}
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
            >
              {t.rich('howItWorks', {
                span: (chunks) => (
                  <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">{chunks}</span>
                ),
              })}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-gray-600 max-w-2xl mx-auto"
            >
              {t('freeplugConnectsConversation72After')}
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid md:grid-cols-3 gap-8"
          >
            {howItWorks.map((item) => (
              <motion.div key={item.step} variants={cardVariants}>
                <Card className="h-full text-left hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 border-0 shadow-lg bg-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e]" />
                  <CardContent className="pt-8 pb-8 px-6">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] flex items-center justify-center shadow-lg shadow-[#ba3d3d]/25">
                        <item.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-[#ba3d3d] uppercase tracking-wider">
                        {t('step', { step: item.step })}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{t(item.title)}</h3>
                    <p className="text-gray-600 leading-relaxed">{t(item.description)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  )
}
