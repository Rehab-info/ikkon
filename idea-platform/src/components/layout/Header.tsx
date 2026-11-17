import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { DemoUserSwitcher } from './DemoUserSwitcher'
import { Logo } from './Logo'
import { NAV_ITEMS } from './nav'

export function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // 画面遷移したらメニューを閉じる
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a, select, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors ${isActive ? 'text-ink font-medium' : 'text-muted hover:text-ink'}`

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="メイン" className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block">
          <DemoUserSwitcher />
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-paper lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" ref={panelRef} className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t border-line bg-white lg:hidden">
          <nav aria-label="モバイル" className="flex flex-col px-4 py-4">
            <NavLink to="/" end className={({ isActive }) => `border-b border-line py-4 text-base ${isActive ? 'font-medium text-ink' : 'text-charcoal'}`}>
              トップ
            </NavLink>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `border-b border-line py-4 text-base ${isActive ? 'font-medium text-ink' : 'text-charcoal'}`}
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/notice" className="border-b border-line py-4 text-base text-charcoal">
              プロトタイプについて
            </NavLink>
            <div className="mt-6 space-y-2">
              <p className="text-xs text-muted">デモ利用者の切り替え（ログインではありません）</p>
              <DemoUserSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
