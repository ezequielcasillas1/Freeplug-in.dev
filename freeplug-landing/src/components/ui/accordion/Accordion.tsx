'use client'

import { useState, createContext, useContext, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AccordionContextValue {
  openItems: Set<string>
  toggle: (id: string) => void
  allowMultiple: boolean
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  children: ReactNode
  allowMultiple?: boolean
  defaultOpen?: string[]
  className?: string
}

export function Accordion({
  children,
  allowMultiple = false,
  defaultOpen = [],
  className,
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen))

  const toggle = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
      }
      return next
    })
  }

  return (
    <AccordionContext.Provider value={{ openItems, toggle, allowMultiple }}>
      <div className={cn('space-y-3', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  id: string
  children: ReactNode
  className?: string
}

export function AccordionItem({ id, children, className }: AccordionItemProps) {
  const context = useContext(AccordionContext)
  if (!context) throw new Error('AccordionItem must be used within Accordion')

  const isOpen = context.openItems.has(id)

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow',
        isOpen && 'shadow-md border-[#ba3d3d]/20',
        className
      )}
    >
      {children}
    </div>
  )
}

interface AccordionTriggerProps {
  id: string
  children: ReactNode
  className?: string
}

export function AccordionTrigger({ id, children, className }: AccordionTriggerProps) {
  const context = useContext(AccordionContext)
  if (!context) throw new Error('AccordionTrigger must be used within Accordion')

  const isOpen = context.openItems.has(id)

  return (
    <button
      type="button"
      onClick={() => context.toggle(id)}
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${id}`}
      className={cn(
        'flex w-full items-center justify-between p-4 text-left font-medium text-gray-900 hover:bg-zinc-50 transition-colors',
        isOpen && 'bg-zinc-50',
        className
      )}
    >
      <span className="pr-4">{children}</span>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex-shrink-0"
      >
        <ChevronDown className={cn('h-5 w-5 text-gray-500', isOpen && 'text-[#ba3d3d]')} />
      </motion.div>
    </button>
  )
}

interface AccordionContentProps {
  id: string
  children: ReactNode
  className?: string
}

export function AccordionContent({ id, children, className }: AccordionContentProps) {
  const context = useContext(AccordionContext)
  if (!context) throw new Error('AccordionContent must be used within Accordion')

  const isOpen = context.openItems.has(id)

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          id={`accordion-content-${id}`}
          role="region"
          aria-labelledby={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className={cn('px-4 pb-4 text-gray-600', className)}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
