import { Container, PageHeader } from '../components/ui/PageHeader'
import { Notice } from '../components/ui/Notice'
import { BRAND } from '../config/brand'
import { PRODUCTION_GAPS } from '../content/productionGaps'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NoticePage() {
  useDocumentTitle('プロトタイプについて')
  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      <PageHeader
        eyebrow="ABOUT THIS PROTOTYPE"
        title="プロトタイプについて"
        description={`${BRAND.name} の主要な体験を確認するためのローカル・プロトタイプです。本番環境として公開・運用しないでください。`}
      />
      <div className="mt-8 space-y-4">
        <Notice tone="demo" title="このプロトタイプで行われること・行われないこと">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>データはこのブラウザの IndexedDB にのみ保存されます。外部サーバーへの送信はありません。</li>
            <li>購入はデモです。決済・契約締結・権利移転は行われません。</li>
            <li>相談申請はデモです。メール等の送信は行われません。</li>
            <li>デモ利用者の切り替えは認証ではありません。運営画面も誰でも表示できます。</li>
            <li>掲載している人物・組織・アイデアはすべて架空です。</li>
            <li>外部フォント・解析ツール・広告などの外部読み込みはありません。</li>
          </ul>
        </Notice>
      </div>
      <h2 className="mt-12 text-xl font-semibold">本番公開に必要な未実装事項</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {PRODUCTION_GAPS.map((g) => (
          <section key={g.area} className="rounded-lg border border-line p-5">
            <h3 className="font-semibold">{g.area}</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-charcoal">
              {g.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Container>
  )
}
