'use client'

import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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

  return (
    <motion.nav
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#ba3d3d]">Freeplug</span>
            <span className="text-2xl font-light text-gray-800">.dev</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-[#ba3d3d]"
            >
              Log in
            </Link>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => router.push('/dashboard')}
            >
              Dashboard
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => router.push('/signup')}
            >
              Get Started
            </Button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-gray-600"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div
          className={cn(
            'md:hidden overflow-hidden transition-all duration-300',
            isOpen ? 'max-h-64 pb-4' : 'max-h-0'
          )}
        >
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium"
            >
              Log in
            </Link>
            <Button
              size="sm"
              className="w-fit"
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
    </motion.nav>
  )
}
