import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/** Locale-aware Link/redirect for PUBLIC pages only (adds /es when the page is Spanish). */
export const { Link: LocalizedLink, redirect: localizedRedirect, usePathname: useLocalizedPathname, getPathname } =
  createNavigation(routing)
