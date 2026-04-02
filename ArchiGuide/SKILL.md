---
name: animation-patterns
description: How to use Framer Motion (v12) with Tailwind CSS in this project. Load when adding animations, transitions, or motion effects to components.
---

# Animation Patterns with Framer Motion

## Architecture Rule

Animation variants MUST be defined in a **separate file** co-located with the component:

```
src/features/{feature}/components/
├── FeatureCard.tsx           ← uses variants from:
└── animations/
    └── card.variants.ts      ← variant definitions live here
```

This keeps component files clean and makes variants reusable.

## Variant File Template

```ts
// animations/page.variants.ts
import type { Variants } from 'framer-motion'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
}
```

## Staggered List Pattern

```tsx
// components/FeatureList.tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, slideUp } from './animations/list.variants'
import type { Feature } from '../types/feature.schema'

interface FeatureListProps {
  items: Feature[]
}

export function FeatureList({ items }: FeatureListProps) {
  return (
    <motion.ul
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <AnimatePresence>
        {items.map((item) => (
          <motion.li key={item.id} variants={slideUp} layout>
            <span>{item.name}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  )
}
```

## Page Transition Pattern

```tsx
// src/components/shared/PageTransition.tsx
'use client'
import { motion } from 'framer-motion'
import { fadeIn } from './animations/page.variants'

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
```

## Rules

- **Never inline `initial`/`animate` objects** with motion values directly on the component. Always reference named variants from a variants file.
- **Prefer `layout` prop** on list items for smooth reorder animations.
- **Use `AnimatePresence`** whenever elements conditionally render so exit animations play.
- **Respect `prefers-reduced-motion`** — wrap animations in a check or use Framer Motion's `useReducedMotion` hook.
- **Do not animate Server Components** — any component using `motion.` must have `'use client'`.

## Reduced Motion Helper

```ts
// src/lib/utils/use-safe-motion.ts
'use client'
import { useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'

export function useSafeVariants(variants: Variants): Variants {
  const shouldReduce = useReducedMotion()
  if (!shouldReduce) return variants
  // Strip transitions, keep final visible state only
  return Object.fromEntries(
    Object.entries(variants).map(([key, val]) => [
      key,
      typeof val === 'object' ? { ...val, transition: { duration: 0 } } : val,
    ])
  )
}
```
