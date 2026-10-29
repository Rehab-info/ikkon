import { Link } from 'react-router-dom'

/** すべての画面に表示する、プロトタイプであることの明示 */
export function DemoBanner() {
  return (
    <div className="border-b border-accent/20 bg-accent-soft text-xs text-charcoal print:hidden">
      <p className="mx-auto max-w-6xl px-4 py-2 leading-relaxed sm:px-6 lg:px-8">
        <span className="mr-2 font-medium text-accent">プロトタイプ</span>
        決済・認証・契約は実装されていません。データはこのブラウザ内にのみ保存され、外部へは送信されません。
        <Link to="/notice" className="ml-1 underline underline-offset-2 hover:text-ink">
          詳しく
        </Link>
      </p>
    </div>
  )
}
