'use client'

import { useState } from 'react'

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="break-all rounded bg-zinc-100 px-2 py-1 text-xs text-gray-800" data-testid="preview-link">
        {link}
      </code>
      <button
        type="button"
        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-zinc-50"
        onClick={async () => {
          await navigator.clipboard.writeText(link)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
