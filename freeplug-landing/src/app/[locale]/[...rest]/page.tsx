import { notFound } from 'next/navigation'

/** Unknown /es/... paths render the localized 404 ([locale]/not-found.tsx). */
export default function CatchAll() {
  notFound()
}
