'use client'

import { useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Cloud,
  Code,
  Gauge,
  Grid3x3,
  LayoutTemplate,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  fadeInUp,
  staggerContainer,
  cardVariants,
  techTileAtRest,
  techTileNoStagger,
  techTileStagger,
  techTileVariants,
} from '../animations/landing.variants'

/**
 * The stack 72 After builds local business sites on (Lina's layout + Sable's copy, Oct 3 2026).
 * One list: add a stack later by adding entries here. Icons are monochrome lucide icons, not brand logos.
 */
export const techStack: ReadonlyArray<{ name: string; description: string; icon: LucideIcon }> = [
  {
    name: 'Envato template',
    description: 'Premium templates our developers have access to, enhanced and filled with your business details.',
    icon: LayoutTemplate,
  },
  { name: 'HTML & CSS', description: 'Plain, lightweight pages that load quickly.', icon: Code },
  { name: 'Bootstrap 5', description: 'A layout that fits phones, tablets and computers.', icon: Grid3x3 },
  { name: 'Cloudflare', description: 'Hosts your site and provides the SSL certificate for https.', icon: Cloud },
  {
    name: 'Cloudflare Turnstile',
    description: 'Filters out spam bots on your quote form, without picture puzzles.',
    icon: ShieldCheck,
  },
  { name: 'Resend', description: 'Emails each quote request to you.', icon: Mail },
]

const techFeatures = [
  {
    icon: Zap,
    title: 'Fast Loading',
    description: "Lightweight pages served from Cloudflare's network.",
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    icon: Smartphone,
    title: 'Mobile First',
    description: 'A responsive layout that adjusts to phones, tablets and computers.',
    gradient: 'from-blue-400 to-indigo-500',
  },
  {
    icon: Search,
    title: 'SEO Basics Included',
    description: 'Clear page titles, descriptions and business details that search engines can read.',
    gradient: 'from-green-400 to-emerald-500',
  },
  {
    icon: Shield,
    title: 'Secure Connection',
    description: "HTTPS on every page through Cloudflare's SSL.",
    gradient: 'from-purple-400 to-violet-500',
  },
]

const noopSubscribe = () => () => {}

/** false on the server and while hydrating, true after: keeps the first client render equal to the SSR HTML. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function TechStackSection() {
  // prefers-reduced-motion: the tiles sit at rest, with no entrance or hover motion. Applied after
  // hydration (useReducedMotion reads the media query on the client only) so the markup never mismatches.
  const prefersReducedMotion = useReducedMotion() === true
  const reduceMotion = useHydrated() && prefersReducedMotion

  return (
    <section id="services" className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4"
          >
            Our Technology
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
          >
            Built On{' '}
            <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
              Proven Tools
            </span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Every local business site we build uses the same setup: lightweight pages, a layout that works on
            phones, a quote form that filters out spam, and a secure https address.
          </motion.p>
        </motion.div>

        <motion.div
          variants={reduceMotion ? techTileNoStagger : techTileStagger}
          initial="hidden"
          whileInView="visible"
          animate={reduceMotion ? 'visible' : undefined}
          viewport={{ once: true }}
          className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-6 sm:gap-6 max-w-5xl mx-auto mb-16"
          data-testid="tech-stack-tiles"
          data-reduced-motion={reduceMotion ? 'true' : undefined}
        >
          {techStack.map((tech) => (
            <motion.div
              key={tech.name}
              variants={reduceMotion ? techTileAtRest : techTileVariants}
              whileHover={reduceMotion ? undefined : { scale: 1.1 }}
              className="group flex flex-col items-center text-center"
              data-testid="tech-tile"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg shadow-gray-200/50 flex items-center justify-center border border-gray-100 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-300/50 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                <tech.icon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-700" aria-hidden="true" strokeWidth={1.75} />
              </div>
              <span className="mt-3 text-xs sm:text-sm font-medium text-gray-600 leading-snug line-clamp-2 break-words">
                {tech.name}
              </span>
              <span className="hidden lg:block mt-1 text-xs text-gray-500 leading-snug">{tech.description}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {techFeatures.map((feature) => (
            <motion.div key={feature.title} variants={cardVariants}>
              <Card className="h-full text-center hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group overflow-hidden relative bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                <CardContent className="pt-8 relative">
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(circle at 25% 25%, rgba(186, 61, 61, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 75% 75%, rgba(138, 46, 46, 0.3) 0%, transparent 50%)
              `,
            }} />
          </div>
          
          <div className="relative p-8 sm:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  Performance That{' '}
                  <span className="text-[#ba3d3d]">Matters</span>
                </h3>
                <p className="text-gray-400 mb-8 leading-relaxed">
                  Sites are built to be mobile-friendly and reasonably fast. We don&apos;t invent uptime or score guarantees.
                </p>
                
                <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3 text-sm text-gray-300">
                  Responsive layouts · Clear quote request pages · Monthly hosting keeps it online
                </div>
              </div>
              
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border border-dashed border-white/20"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-8 rounded-full border border-dashed border-[#ba3d3d]/30"
                />
                <div className="relative aspect-square flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="w-32 h-32 rounded-full bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] flex items-center justify-center shadow-2xl shadow-[#ba3d3d]/30"
                  >
                    <Gauge className="w-16 h-16 text-white" />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
