'use client'

import { motion } from 'framer-motion'
import { Heart, Users, Globe, CheckCircle, Rocket, TrendingUp, Award } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants, slideInLeft, slideInRight } from '../animations/landing.variants'

const values = [
  {
    icon: Heart,
    title: 'Our Mission',
    description: 'We help struggling local businesses get their first professional website, completely free of charge.',
    gradient: 'from-rose-400 to-red-500',
  },
  {
    icon: Users,
    title: 'For Everyone',
    description: 'Whether you\'re just starting out or looking to expand, we\'re here for businesses at any level.',
    gradient: 'from-blue-400 to-indigo-500',
  },
  {
    icon: Globe,
    title: 'Professional Quality',
    description: 'Every website we build meets modern standards with responsive design and fast performance.',
    gradient: 'from-emerald-400 to-teal-500',
  },
]

const benefits = [
  { text: 'No upfront costs for website development', icon: Rocket },
  { text: 'Professional, modern design', icon: Award },
  { text: 'Mobile-responsive layouts', icon: Globe },
  { text: 'Ongoing support and maintenance', icon: Heart },
  { text: 'Easy content management', icon: Users },
  { text: 'SEO-friendly structure', icon: TrendingUp },
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
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
            About Us
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
          >
            Empowering{' '}
            <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
              Local Businesses
            </span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Freeplug.dev was founded with a simple belief: every business deserves 
            a strong online presence, regardless of their budget.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-3 gap-8 mb-20"
        >
          {values.map((value, index) => (
            <motion.div key={value.title} variants={cardVariants}>
              <Card className="h-full text-center hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group overflow-hidden relative border-0 shadow-lg bg-white">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-10 pb-8">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className={`w-16 h-16 bg-gradient-to-br ${value.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}
                  >
                    <value.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{value.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#ba3d3d] via-[#a53434] to-[#8a2e2e]" />
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
          
          <div className="relative p-8 sm:p-12 lg:p-16">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={slideInLeft}>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6">
                  Everything You Need to{' '}
                  <span className="text-white/90 underline decoration-wavy decoration-white/30 underline-offset-4">
                    Succeed Online
                  </span>
                </h3>
                <p className="text-white/80 mb-8 text-lg leading-relaxed">
                  When you partner with Freeplug.dev, you receive a complete 
                  professional website solution designed to help your business grow.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <motion.li
                      key={benefit.text}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-center gap-4 text-white group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <benefit.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white/90">{benefit.text}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
              
              <motion.div variants={slideInRight}>
                <div className="bg-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ba3d3d]/10 to-transparent rounded-bl-full" />
                  
                  <h4 className="text-2xl font-bold text-gray-900 mb-6 relative">
                    Only Pay For
                  </h4>
                  
                  <div className="space-y-6 relative">
                    <motion.div 
                      whileHover={{ x: 5 }}
                      className="flex justify-between items-center pb-6 border-b border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-gray-700 font-medium">Hosting</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">Coming Soon</span>
                    </motion.div>
                    
                    <motion.div 
                      whileHover={{ x: 5 }}
                      className="flex justify-between items-center pb-6 border-b border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                          <Heart className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-gray-700 font-medium">Maintenance</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">Coming Soon</span>
                    </motion.div>
                    
                    <motion.div 
                      whileHover={{ x: 5 }}
                      className="flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                          <Rocket className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-gray-700 font-medium">Website Development</span>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-bold bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">$0</span>
                        <p className="text-xs text-gray-500">Forever free</p>
                      </div>
                    </motion.div>
                  </div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    viewport={{ once: true }}
                    className="mt-8 p-4 rounded-xl bg-gradient-to-r from-[#ba3d3d]/10 to-[#8a2e2e]/10 border border-[#ba3d3d]/20"
                  >
                    <p className="text-sm text-gray-600 text-center">
                      <span className="font-semibold text-[#ba3d3d]">No hidden fees.</span>{' '}
                      No surprise charges. Just honest service.
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
