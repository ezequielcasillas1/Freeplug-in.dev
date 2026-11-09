import { AppWindow, Briefcase, CalendarCheck, ShoppingBag, Sparkles, Store } from 'lucide-react'

/**
 * Home page "What we build" cards (ported from offerings-2026-10-22, landing only).
 * No project-type picker / DB field on this branch: cards link to the existing request flow.
 * No per-type pricing until Cheke sets it.
 */
export const HOME_OFFERINGS = ['local', 'agency', 'creator', 'booking', 'store', 'saas'] as const
export type HomeOffering = (typeof HOME_OFFERINGS)[number]

export const HOME_OFFERING_ICONS: Record<HomeOffering, typeof Store> = {
  local: Store,
  agency: Briefcase,
  creator: Sparkles,
  booking: CalendarCheck,
  store: ShoppingBag,
  saas: AppWindow,
}
