'use client'

import { motion } from 'framer-motion'
import { Code2, Layers, Zap, Lock, Smartphone, Search, Gauge, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fadeInUp, staggerContainer, cardVariants, techLogoVariants } from '../animations/landing.variants'

const techLogos = [
  { name: 'React', color: '#61DAFB', icon: '⚛️' },
  { name: 'Next.js', color: '#000000', icon: '▲' },
  { name: 'TypeScript', color: '#3178C6', icon: 'TS' },
  { name: 'Tailwind', color: '#06B6D4', icon: '🎨' },
  { name: 'Vercel', color: '#000000', icon: '▼' },
  { name: 'Supabase', color: '#3ECF8E', icon: '⚡' },
]

const techFeatures = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Sub-second load times with optimized assets and edge delivery',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    icon: Smartphone,
    title: 'Mobile First',
    description: 'Responsive design that looks perfect on every device',
    gradient: 'from-blue-400 to-indigo-500',
  },
  {
    icon: Search,
    title: 'SEO Optimized',
    description: 'Built-in SEO best practices to help you rank higher',
    gradient: 'from-green-400 to-emerald-500',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'HTTPS, secure headers, and best security practices',
    gradient: 'from-purple-400 to-violet-500',
  },
]

const stats = [
  { value: '99.9%', label: 'Uptime' },
  { value: '<1s', label: 'Load Time' },
  { value: '100', label: 'Lighthouse Score' },
  { value: '24/7', label: 'Monitoring' },
]

export function TechStackSection() {
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
            Built With{' '}
            <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
              Modern Tech
            </span>
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
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-16"
        >
          {techLogos.map((tech, index) => (
            <motion.div
              key={tech.name}
              variants={techLogoVariants}
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="group relative"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg shadow-gray-200/50 flex items-center justify-center border border-gray-100 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-300/50 group-hover:-translate-y-1">
                <span className="text-2xl sm:text-3xl">{tech.icon}</span>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileHover={{ opacity: 1, y: 0 }}
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded shadow-sm"
              >
                {tech.name}
              </motion.div>
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
                  Every website we build is optimized for maximum performance. 
                  Fast loading times mean better user experience and higher search rankings.
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
                    >
                      <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.value}</div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">{stat.label}</div>
                    </motion.div>
                  ))}
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
