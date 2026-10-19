/**
 * Slim launch banner for public pre-login pages (rendered inside the public Navigation).
 * No locale mechanism exists on FP0.5 yet, so only EN renders. The ES string is kept ready in
 * LAUNCH_MARQUEE_COPY.es for when the i18n catalog lands.
 */
export const LAUNCH_MARQUEE_COPY = {
  en: 'Officially launching this weekend — Saturday & Sunday!',
  es: '¡Lanzamiento oficial este fin de semana — sábado y domingo!',
} as const

export type LaunchMarqueeLocale = keyof typeof LAUNCH_MARQUEE_COPY

export function LaunchMarquee({ locale = 'en' }: { locale?: LaunchMarqueeLocale }) {
  const text = LAUNCH_MARQUEE_COPY[locale]
  return (
    <div
      className="launch-marquee relative overflow-hidden bg-gradient-to-r from-[#8a2e2e] via-[#ba3d3d] to-[#8a2e2e] text-white text-xs sm:text-sm font-medium"
      role="region"
      aria-label={locale === 'es' ? 'Anuncio de lanzamiento' : 'Launch announcement'}
      aria-live="off"
      data-testid="launch-marquee"
    >
      {/* Static copy for screen readers; the moving track is decorative duplicates. */}
      <p className="sr-only">{text}</p>
      <div className="launch-marquee__track flex w-max whitespace-nowrap py-1.5" aria-hidden="true">
        {[0, 1].map((half) => (
          <div key={half} className="launch-marquee__group flex shrink-0">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="px-8">{text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
