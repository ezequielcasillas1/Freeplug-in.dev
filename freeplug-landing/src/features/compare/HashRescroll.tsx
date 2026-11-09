'use client'

import { useEffect } from 'react'

/**
 * Luma (Oct 31): on first load /#compare can land too high because content above it grows after
 * hydration. Re-scroll once things settle. Renders nothing; the section itself stays server-rendered.
 */
export function HashRescroll({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return
    const go = () => document.getElementById(id)?.scrollIntoView({ block: 'start' })
    const raf = requestAnimationFrame(go)
    const timer = window.setTimeout(go, 400)
    window.addEventListener('load', go, { once: true })
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      window.removeEventListener('load', go)
    }
  }, [id])
  return null
}
