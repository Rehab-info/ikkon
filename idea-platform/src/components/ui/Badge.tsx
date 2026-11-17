import type { ReactNode } from 'react'
import type { BadgeTone } from '../../lib/labels'

const tones: Record<BadgeTone, string> = {
  ink: 'bg-ink text-white',
  brass: 'bg-accent-soft text-accent',
  slate: 'bg-slate-soft text-charcoal',
  rust: 'bg-rust-soft text-rust',
  moss: 'bg-moss-soft text-moss',
  outline: 'border border-line-strong text-muted',
}

export function Badge({ tone = 'slate', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium leading-5 ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
