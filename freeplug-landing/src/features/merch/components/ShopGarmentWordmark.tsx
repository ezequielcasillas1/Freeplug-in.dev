/** Vector Supreme-style Freeplug box wordmark for buyer-shop mockup overlays (replaces low-res PNGs in UI). */

const RED = '#b13b39'
const CURSIVE = "'FP Cursive Demo', cursive"

export function ShopGarmentWordmark({
  variant,
  className,
}: {
  /** `dark` = light ink on dark blanks; `light` = dark ink on light blanks */
  variant: 'dark' | 'light'
  className?: string
}) {
  const textFill = variant === 'dark' ? '#ffffff' : '#0a0a0a'
  const stroke = variant === 'dark' ? '#ffffff' : undefined

  return (
    <svg
      className={className}
      viewBox="0 0 300 100"
      role="presentation"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="2" y="8" width="296" height="84" rx="6" fill={RED} />
      {stroke ? (
        <rect
          x="2"
          y="8"
          width="296"
          height="84"
          rx="6"
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
        />
      ) : null}
      <text
        x="150"
        y="58"
        fill={textFill}
        fontFamily={CURSIVE}
        fontSize="52"
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ textRendering: 'geometricPrecision' }}
      >
        Freeplug
      </text>
    </svg>
  )
}

export function isShopGarmentLogoPath(src: string | null | undefined): boolean {
  if (!src) return false
  return /\/merch\/shop\/freeplug-logo-(dark|light)-garment\.(png|svg)$/i.test(src)
}

export function garmentLogoVariant(src: string): 'dark' | 'light' {
  return src.includes('light-garment') ? 'light' : 'dark'
}
