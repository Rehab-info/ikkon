import { Link } from 'react-router-dom'
import { BRAND } from '../../config/brand'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">肩書きではなく、アイデアを通じて人の可能性を発見する。</p>
          <p className="mt-4 text-xs text-muted">掲載している人物・アイデアはすべて架空のデモデータです。</p>
        </div>
        <nav aria-label="フッター：サービス" className="space-y-2 text-sm">
          <p className="font-medium text-ink">サービス</p>
          <Link to="/ideas" className="block text-muted hover:text-ink">アイデアを探す</Link>
          <Link to="/workspace" className="block text-muted hover:text-ink">アイデアを生み出す</Link>
          <Link to="/account" className="block text-muted hover:text-ink">マイページ</Link>
        </nav>
        <nav aria-label="フッター：このプロトタイプについて" className="space-y-2 text-sm">
          <p className="font-medium text-ink">このプロトタイプについて</p>
          <Link to="/notice" className="block text-muted hover:text-ink">本番未対応の事項</Link>
          <Link to="/admin" className="block text-muted hover:text-ink">運営画面（デモ）</Link>
          <span className="block text-muted">利用規約・プライバシーポリシー（準備中）</span>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">© {new Date().getFullYear()} {BRAND.copyrightHolder} — Prototype</p>
      </div>
    </footer>
  )
}
