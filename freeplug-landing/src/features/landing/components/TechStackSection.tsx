'use client'

import { motion } from 'framer-motion'
import { Code2, Layers, Zap, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants } from '../animations/landing.variants'

const techFeatures = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Optimized for speed and performance',
  },
  {
    icon: Layers,
    title: 'Modern Stack',
    description: 'Built with the latest technologies',
  },
  {
    icon: Code2,
    title: 'Clean Code',
    description: 'Maintainable and scalable architecture',
  },
  {
    icon: Lock,
    title: 'Secure',
    description: 'Security best practices built-in',
  },
]

export function TechStackSection() {
  return (
    <section id="services" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="text-[#ba3d3d] font-semibold text-sm uppercase tracking-wider"
          >
            Our Technology
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4 mb-6"
          >
            Built With Modern Tech
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            We use cutting-edge technologies to ensure your website is fast, 
            secure, and future-proof.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          {techFeatures.map((feature) => (
            <motion.div key={feature.title} variants={cardVariants}>
              <Card className="h-full text-center hover:shadow-xl transition-shadow hover:-translate-y-1 duration-300">
                <CardContent className="pt-8">
                  <div className="w-12 h-12 bg-[#ba3d3d]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-[#ba3d3d]" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
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
          className="bg-white rounded-2xl p-8 sm:p-12 border border-gray-200 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Coming Soon
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Full Tech Stack Details
          </h3>
          <p className="text-gray-600 max-w-lg mx-auto">
            We&apos;re preparing a detailed breakdown of all the technologies 
            we use to build your perfect website. Stay tuned!
          </p>
        </motion.div>
      </div>
    </section>
  )
}
