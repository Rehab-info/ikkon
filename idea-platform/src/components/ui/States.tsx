import { CircleCheck, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function Loading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status" aria-live="polite">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      {Icon && <Icon className="mx-auto mb-3 size-6 text-muted" aria-hidden />}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'エラーが発生しました', message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-rust/30 bg-rust-soft/50 px-6 py-8 text-center" role="alert">
      <TriangleAlert className="mx-auto mb-3 size-6 text-rust" aria-hidden />
      <p className="font-medium text-rust">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md whitespace-pre-line text-sm text-charcoal">{message}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function SaveStatus({ state, savedAt }: { state: SaveState; savedAt?: string }) {
  const map: Record<SaveState, { text: string; className: string; icon?: ReactNode }> = {
    idle: { text: 'このブラウザに保存されています', className: 'text-muted' },
    dirty: { text: '未保存の変更があります', className: 'text-accent' },
    saving: { text: '保存中…', className: 'text-muted', icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> },
    saved: {
      text: savedAt ? `保存しました（${savedAt}）` : '保存しました',
      className: 'text-moss',
      icon: <CircleCheck className="size-3.5" aria-hidden />,
    },
    error: { text: '保存に失敗しました', className: 'text-rust', icon: <TriangleAlert className="size-3.5" aria-hidden /> },
  }
  const s = map[state]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${s.className}`} role="status" aria-live="polite" data-testid="save-status">
      {s.icon}
      {s.text}
    </span>
  )
}
