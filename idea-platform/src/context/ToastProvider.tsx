import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ToastTone } from './toast'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = ++seq
      setItems((list) => [...list.slice(-2), { id, message, tone }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 print:hidden" aria-live="polite" role="status">
        {items.map((t) => {
          const Icon = t.tone === 'error' ? TriangleAlert : t.tone === 'info' ? Info : CircleCheck
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border bg-white px-4 py-3 text-sm shadow-sm ${
                t.tone === 'error' ? 'border-rust/40 text-rust' : 'border-line text-charcoal'
              }`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${t.tone === 'success' ? 'text-moss' : ''}`} aria-hidden />
              <p className="flex-1 whitespace-pre-line">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="閉じる">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
