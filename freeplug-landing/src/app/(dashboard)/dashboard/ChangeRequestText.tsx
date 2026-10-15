'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { CHANGE_REQUEST_SHOW_ALL, CHANGE_REQUEST_SHOW_LESS } from '@/lib/change-requests/copy'

/** Lina (Oct 10): whole request, wrapped; past about 6 lines clamp there with Show all / Show less. */
export const CLAMP_LINES = 6
/** Before layout is measured (and in tests): about 6 lines of ~55 chars at 375px, or 7+ line breaks. */
export function looksLong(text: string): boolean {
  return text.length > CLAMP_LINES * 55 || text.split('\n').length > CLAMP_LINES
}

/**
 * The customer's own words, shown exactly as sent (line breaks kept). The button only appears
 * when the text overflows 6 lines; it is a real <button> with aria-expanded/aria-controls.
 */
export function ChangeRequestText({ id, text }: { id: string; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [long, setLong] = useState(() => looksLong(text))

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded || el.clientHeight === 0) return // no layout (SSR/jsdom): keep the estimate
    setLong(el.scrollHeight > el.clientHeight + 1)
  }, [text, expanded])

  const textId = `change-request-text-${id}`
  return (
    <div className="mt-1">
      <p
        id={textId}
        ref={ref}
        className={`text-sm text-gray-700 break-words whitespace-pre-wrap ${expanded ? '' : 'line-clamp-6'}`}
        data-testid="change-request-text"
        data-expanded={expanded ? 'true' : 'false'}
      >
        {text}
      </p>
      {long || expanded ? (
        <button
          type="button"
          className="mt-1 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={() => setExpanded((v) => !v)}
          data-testid="change-request-show-all"
        >
          {expanded ? CHANGE_REQUEST_SHOW_LESS : CHANGE_REQUEST_SHOW_ALL}
        </button>
      ) : null}
    </div>
  )
}
