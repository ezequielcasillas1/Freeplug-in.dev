'use client'

import { getBrandNameLabel, type BrandNameKey } from '@/lib/merch/preview/brand-names'
import type { WordmarkTreatment } from '@/lib/merch/preview/wordmark-variations'

const CURSIVE = "'FP Cursive Demo', cursive"
const EXTENDED = "'FP Extended Demo', sans-serif"
const DISPATCH = "'Freeplug Dispatch', sans-serif"
const CONDENSED = "'Freeplug Dispatch Condensed', sans-serif"
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace"

export type WordmarkInk = 'light-on-dark' | 'dark-on-light'

export function wordmarkInkForBlank(blank: 'light' | 'dark'): WordmarkInk {
  return blank === 'light' ? 'dark-on-light' : 'light-on-dark'
}

function inkColors(ink: WordmarkInk) {
  if (ink === 'dark-on-light') {
    return { fg: '#171717', muted: '#525252', boxFill: '#f4f4f5', accent: '#ba3d3d', red: '#ba3d3d' }
  }
  return { fg: '#ffffff', muted: '#e5e5e5', boxFill: '#0a0a0a', accent: '#b13b39', red: '#b13b39' }
}

function Cover({ ink, w, h }: { ink: WordmarkInk; w: number; h: number }) {
  const { boxFill } = inkColors(ink)
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={boxFill} />
}

function splitFreeplugDev(label: string): { a: string; b: string } {
  if (label.includes('.dev')) return { a: 'Freeplug', b: '.dev' }
  if (label.includes('.in')) return { a: 'Freeplug', b: '.in' }
  return { a: label, b: '' }
}

export function WordmarkTreatmentArt({
  treatment,
  nameKey,
  ink,
  compact,
}: {
  treatment: WordmarkTreatment
  nameKey: BrandNameKey
  ink: WordmarkInk
  compact?: boolean
}) {
  const label = getBrandNameLabel(nameKey)
  const c = inkColors(ink)
  const parts = splitFreeplugDev(label)
  const covW = compact ? 40 : 46
  const covH = compact ? 12 : 14

  switch (treatment) {
    case 'code-mono-panel':
      return (
        <g>
          <Cover ink={ink} w={covW} h={covH} />
          <rect x={-21} y={-6} width={42} height={12} rx={1} fill={ink === 'light-on-dark' ? '#1a1a1a' : '#e4e4e7'} stroke={c.fg} strokeWidth={0.35} />
          <text x={0} y={1.8} fill={c.fg} fontFamily={MONO} fontSize={compact ? 4.4 : 5} fontWeight={600} textAnchor="middle" letterSpacing="-0.05em">
            {label}
          </text>
        </g>
      )
    case 'inverted-white-panel':
      return (
        <g>
          <Cover ink={ink} w={38} h={covH} />
          <rect x={-17} y={-6.5} width={34} height={13} fill={ink === 'light-on-dark' ? '#f5f5f5' : '#171717'} />
          <text x={0} y={2} fill={ink === 'light-on-dark' ? '#0a0a0a' : '#fff'} fontFamily={DISPATCH} fontSize={5.5} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'outline-text-only':
      return (
        <g>
          <Cover ink={ink} w={covW} h={12} />
          <text x={0} y={2} fill="none" stroke={c.fg} strokeWidth={0.55} fontFamily={DISPATCH} fontSize={nameKey === 'freeplug-in' ? 7.2 : 6.2} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'underline-accent':
      return (
        <g>
          <Cover ink={ink} w={42} h={11} />
          <text x={0} y={0.5} fill={c.fg} fontFamily={DISPATCH} fontSize={5.8} fontWeight={700} textAnchor="middle">
            {label}
          </text>
          <line x1={-18} y1={3.5} x2={18} y2={3.5} stroke={c.red} strokeWidth={0.9} />
        </g>
      )
    case 'mono-brackets':
      return (
        <g>
          <Cover ink={ink} w={44} h={12} />
          <text x={0} y={2} fill={c.fg} fontFamily={MONO} fontSize={4.8} textAnchor="middle">
            {'{ '}
            {label}
            {' }'}
          </text>
        </g>
      )
    case 'red-box-script':
      return (
        <g>
          <Cover ink={ink} w={36} h={16} />
          <rect x={-16} y={-7} width={32} height={14} rx={2} fill={c.red} />
          <text x={0} y={2.5} fill="#fff" fontFamily={CURSIVE} fontSize={8.5} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'white-invert-box':
      return (
        <g>
          <Cover ink={ink} w={36} h={15} />
          <rect x={-16} y={-6.5} width={32} height={13} fill="#fff" stroke={c.fg} strokeWidth={0.4} />
          <text x={0} y={2} fill="#0a0a0a" fontFamily={DISPATCH} fontSize={6.5} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'outline-hollow-box':
      return (
        <g>
          <Cover ink={ink} w={34} h={15} />
          <rect x={-15} y={-6.5} width={30} height={13} fill="none" stroke={c.fg} strokeWidth={0.65} />
          <text x={0} y={2} fill={c.fg} fontFamily={CONDENSED} fontSize={7} textAnchor="middle" letterSpacing="0.12em">
            {label.toUpperCase()}
          </text>
        </g>
      )
    case 'slanted-italic-box':
      return (
        <g transform="skewX(-8)">
          <Cover ink={ink} w={32} h={14} />
          <rect x={-14} y={-6} width={28} height={12} fill={c.boxFill} stroke={c.fg} strokeWidth={0.45} />
          <text x={0} y={2} fill={c.fg} fontFamily={DISPATCH} fontSize={6} fontStyle="italic" fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'stamp-badge':
      return (
        <g>
          <Cover ink={ink} w={34} h={15} />
          <rect x={-15} y={-6.5} width={30} height={13} fill={c.boxFill} stroke={c.fg} strokeWidth={0.8} />
          <text x={0} y={2} fill={c.fg} fontFamily={CONDENSED} fontSize={7.5} textAnchor="middle" letterSpacing="0.2em">
            {nameKey === 'fplgn' ? label : label.toUpperCase()}
          </text>
        </g>
      )
    case 'script-float':
      return (
        <g>
          <Cover ink={ink} w={30} h={14} />
          <text x={0} y={3} fill={c.red} fontFamily={CURSIVE} fontSize={10} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'wide-stretched':
      return (
        <g>
          <Cover ink={ink} w={48} h={11} />
          <text x={0} y={2} fill={c.fg} fontFamily={EXTENDED} fontSize={9.5} textAnchor="middle" letterSpacing="0.28em">
            {label.toUpperCase()}
          </text>
        </g>
      )
    case 'stacked-two-line':
      return (
        <g>
          <Cover ink={ink} w={34} h={18} />
          <text x={0} y={-3} fill={c.fg} fontFamily={DISPATCH} fontSize={5.5} fontWeight={700} textAnchor="middle">
            FREEPLUG
          </text>
          <text x={0} y={4.5} fill={c.accent} fontFamily={EXTENDED} fontSize={5} textAnchor="middle" letterSpacing="0.18em">
            {nameKey === 'freeplugin' ? 'PLUGIN' : 'IN'}
          </text>
        </g>
      )
    case 'double-strike':
      return (
        <g>
          <Cover ink={ink} w={44} h={11} />
          <text x={0} y={2} fill={c.fg} fontFamily={EXTENDED} fontSize={8} textAnchor="middle" letterSpacing="0.14em">
            {label.toUpperCase()}
          </text>
          <line x1={-20} y1={0} x2={20} y2={0} stroke={c.red} strokeWidth={0.5} opacity={0.85} />
        </g>
      )
    case 'charcoal-box-dispatch':
      return (
        <g>
          <Cover ink={ink} w={38} h={14} />
          <rect x={-17} y={-6} width={34} height={12} fill={ink === 'light-on-dark' ? '#d4d4d4' : '#454545'} />
          <text x={0} y={2.2} fill={c.fg} fontFamily={DISPATCH} fontSize={6} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'wide-tracking-caps':
      return (
        <g>
          <Cover ink={ink} w={46} h={10} />
          <text x={0} y={2} fill={c.fg} fontFamily={CONDENSED} fontSize={8} textAnchor="middle" letterSpacing="0.35em">
            {label.toUpperCase()}
          </text>
        </g>
      )
    case 'split-dot-badge':
      return (
        <g>
          <Cover ink={ink} w={32} h={18} />
          <rect x={-14} y={-7.5} width={28} height={15} rx={2} fill={c.boxFill} stroke={c.fg} strokeWidth={0.45} />
          <text x={0} y={-2} fill={c.fg} fontFamily={DISPATCH} fontSize={4.6} fontWeight={700} textAnchor="middle">
            {parts.a.toUpperCase()}
          </text>
          <text x={0} y={4.8} fill={c.red} fontFamily={MONO} fontSize={4.5} textAnchor="middle">
            {parts.b || '.dev'}
          </text>
        </g>
      )
    case 'red-box-dispatch':
      return (
        <g>
          <Cover ink={ink} w={34} h={14} />
          <rect x={-15} y={-6} width={30} height={12} fill={c.red} />
          <text x={0} y={2.2} fill="#fff" fontFamily={DISPATCH} fontSize={5.8} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'chest-left-mini-box':
      return (
        <g transform="translate(-8 0)">
          <Cover ink={ink} w={22} h={11} />
          <rect x={-10} y={-5} width={20} height={10} fill={c.boxFill} stroke={c.fg} strokeWidth={0.4} />
          <text x={0} y={1.8} fill={c.fg} fontFamily={MONO} fontSize={3.8} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'vertical-stack-tight':
      return (
        <g>
          <Cover ink={ink} w={22} h={20} />
          <text x={0} y={-4} fill={c.fg} fontFamily={DISPATCH} fontSize={4} fontWeight={700} textAnchor="middle">
            FREE
          </text>
          <text x={0} y={2} fill={c.fg} fontFamily={DISPATCH} fontSize={4} fontWeight={700} textAnchor="middle">
            PLUG
          </text>
          <text x={0} y={7.5} fill={c.red} fontFamily={MONO} fontSize={3.6} textAnchor="middle">
            .dev
          </text>
        </g>
      )
    case 'thick-outline-box':
      return (
        <g>
          <Cover ink={ink} w={40} h={14} />
          <rect x={-17} y={-6} width={34} height={12} fill="none" stroke={c.fg} strokeWidth={1.1} />
          <text x={0} y={2} fill={c.fg} fontFamily={DISPATCH} fontSize={6.2} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'pill-outline':
      return (
        <g>
          <Cover ink={ink} w={42} h={12} />
          <rect x={-18} y={-5} width={36} height={10} rx={5} fill="none" stroke={c.fg} strokeWidth={0.55} />
          <text x={0} y={2} fill={c.fg} fontFamily={DISPATCH} fontSize={5.5} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'accent-bar-left':
      return (
        <g>
          <Cover ink={ink} w={44} h={11} />
          <rect x={-20} y={-4} width={3} height={8} fill={c.red} />
          <text x={2} y={2} fill={c.fg} fontFamily={DISPATCH} fontSize={5.8} fontWeight={700} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    case 'dash-border-stamp':
      return (
        <g>
          <Cover ink={ink} w={36} h={16} />
          <rect x={-16} y={-7} width={32} height={14} fill={c.boxFill} stroke={c.fg} strokeWidth={0.65} strokeDasharray="2 1.2" />
          <text x={0} y={2} fill={c.fg} fontFamily={CONDENSED} fontSize={9.5} textAnchor="middle" letterSpacing="0.3em">
            {label}
          </text>
        </g>
      )
    case 'condensed-red-fill':
      return (
        <g>
          <Cover ink={ink} w={38} h={15} />
          <rect x={-17} y={-6.5} width={34} height={13} fill={c.red} />
          <text x={0} y={2.2} fill="#fff" fontFamily={CONDENSED} fontSize={10} textAnchor="middle" letterSpacing="0.26em">
            {label}
          </text>
        </g>
      )
    case 'corner-ribbon':
      return (
        <g transform="translate(-14 -6) scale(0.72)">
          <Cover ink={ink} w={24} h={10} />
          <rect x={-11} y={-4.5} width={22} height={9} fill={c.red} />
          <text x={0} y={1.5} fill="#fff" fontFamily={CONDENSED} fontSize={5} textAnchor="middle">
            {label}
          </text>
        </g>
      )
    default:
      return (
        <g>
          <Cover ink={ink} w={36} h={12} />
          <text x={0} y={2} fill={c.fg} fontFamily={DISPATCH} fontSize={6} textAnchor="middle">
            {label}
          </text>
        </g>
      )
  }
}
