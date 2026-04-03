'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { Menu, X, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { fadeIn } from '../animations/landing.variants'

const navLinks = [
  { label: 'Home', href: '#hero' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Plans', href: '#hosting-plans' },
]

export function Navigation() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  
  const { scrollY } = useScroll()
  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.95)']
  )
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 1])

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      style={{ backgroundColor }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-shadow duration-300",
        hasScrolled && "shadow-lg shadow-black/5"
      )}
    >
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gray-200"
        style={{ opacity: borderOpacity }}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ba3d3d] to-[#8a2e2e] flex items-center justify-center shadow-lg shadow-[#ba3d3d]/30"
            >
              <Sparkles className="w-4 h-4 text-white" />
            </motion.div>
            <span className="text-2xl font-bold text-[#ba3d3d] group-hover:text-[#8a2e2e] transition-colors">Freeplug</span>
            <span className="text-2xl font-light text-gray-800">.dev</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative px-4 py-2 text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium group"
              >
                {link.label}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#ba3d3d] group-hover:w-1/2 transition-all duration-300 rounded-full" />
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#ba3d3d] transition-colors"
            >
              Log in
            </Link>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => router.push('/dashboard')}
              className="bg-gray-100 hover:bg-gray-200"
            >
              Dashboard
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => router.push('/signup')}
              className="shadow-lg shadow-[#ba3d3d]/30 hover:shadow-xl hover:shadow-[#ba3d3d]/40 transition-all"
            >
              Get Started
            </Button>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-gray-600 hover:text-[#ba3d3d] transition-colors rounded-xl hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </motion.button>
        </div>

        <motion.div
          initial={false}
          animate={{ 
            height: isOpen ? 'auto' : 0,
            opacity: isOpen ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="lg:hidden overflow-hidden"
        >
          <div className="py-4 space-y-2 border-t border-gray-100">
            {navLinks.map((link, index) => (
              <motion.a
                key={link.label}
                href={link.href}
                onClick={() => setIsOpen(false)}
                initial={{ opacity: 0, x: -20 }}
                animate={isOpen ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: index * 0.05 }}
                className="block px-4 py-3 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
              >
                {link.label}
              </motion.a>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
              >
                Log in
              </Link>
              <div className="px-4 flex gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/dashboard')
                  }}
                >
                  Dashboard
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/signup')
                  }}
                >
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.nav>
  )
}
