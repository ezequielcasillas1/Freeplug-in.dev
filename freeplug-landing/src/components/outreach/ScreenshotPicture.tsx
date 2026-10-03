/**
 * The customer's site as a full-page screenshot (desktop image on wide screens, phone image on
 * phones). Loaded lazily so the banner and Claim button show first; never cropped or overlaid.
 * The URLs are short-lived signed links handed out only after the link check.
 */
export function ScreenshotPicture({ desktop, mobile, alt }: { desktop: string | null; mobile: string | null; alt: string }) {
  const fallback = desktop ?? mobile
  if (!fallback) return null
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <picture>
        {mobile ? <source media="(max-width: 767px)" srcSet={mobile} /> : null}
        <img src={fallback} alt={alt} loading="lazy" decoding="async" className="block h-auto w-full" data-testid="site-screenshot" />
      </picture>
    </div>
  )
}
