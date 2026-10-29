import { Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

/** 注意書き・デモ表示 */
export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'demo' | 'warning'; title?: string; children: ReactNode }) {
  const styles = {
    info: 'border-line bg-paper text-charcoal',
    demo: 'border-accent/30 bg-accent-soft text-charcoal',
    warning: 'border-rust/30 bg-rust-soft text-charcoal',
  }[tone]
  const Icon = tone === 'warning' ? TriangleAlert : Info
  return (
    <div className={`flex gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      <Icon className={`mt-1 size-4 shrink-0 ${tone === 'warning' ? 'text-rust' : 'text-accent'}`} aria-hidden />
      <div>
        {title && <p className="font-medium text-ink">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
