import { notFound } from 'next/navigation'

/**
 * Unknown /dashboard/* paths (Oct 31). Without this they fell through to the public root 404.
 * Static dashboard routes win over this catch-all; the dashboard layout's auth check still runs
 * first, then dashboard/not-found.tsx renders inside the layout.
 */
export default function DashboardCatchAll(): never {
  notFound()
}
