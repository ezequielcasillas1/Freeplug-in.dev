'use client'

import { motion } from 'framer-motion'
import { CreditCard } from 'lucide-react'
import { HostingCheckoutCard } from '@/components/plans/HostingCheckoutCard'
import { MaintenancePlanCard } from '@/components/plans/MaintenancePlanCard'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'

const MAINTENANCE_LOGIN_NEXT = encodeURIComponent(
  '/dashboard/request-website?focus=maintenance'
)

type Props = {
  signedIn: boolean
  hostingCheckoutAllowed: boolean
}

export function HostingPlansSectionUi({
  signedIn,
  hostingCheckoutAllowed,
}: Props) {
  return (
    <section
      id="hosting-plans"
      className="py-24 bg-zinc-50 border-y border-zinc-200/80"
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <motion.div variants={fadeInUp} className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-[#ba3d3d] text-sm font-medium mb-2">
            <CreditCard size={16} />
            Stripe checkout
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Hosting & maintenance
          </h2>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            Choose a monthly hosting amount and optional add-on. For maintenance, we analyze your
            request first — then quote and invoice.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div variants={fadeInUp}>
            <HostingCheckoutCard
              signedIn={signedIn}
              allowCheckout={hostingCheckoutAllowed}
            />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <MaintenancePlanCard ctaHref={`/login?next=${MAINTENANCE_LOGIN_NEXT}`} />
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
