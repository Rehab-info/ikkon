import { ArrowLeft, CircleCheck, FileText, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, ButtonLink } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { Container } from '../components/ui/PageHeader'
import { ErrorState, Loading } from '../components/ui/States'
import { CHECKOUT_AGREEMENTS, PURCHASE_TERMS_SUMMARY } from '../content/terms'
import { useDemoUser } from '../context/demoUser'
import { NONDISCLOSURE_MONTHS } from '../data/seed'
import { db } from '../db/database'
import { createPurchaseDemo, DemoError } from '../db/repo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { formatDateTime, formatYen } from '../lib/format'
import type { PurchaseDemo } from '../types'

export default function CheckoutPage() {
  useDocumentTitle('購入確認（デモ）')
  const { id = '' } = useParams()
  const { user } = useDemoUser()
  const ideaQuery = useLiveData(() => db.ideas.get(id), [id])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PurchaseDemo | null>(null)

  if (ideaQuery.loading) return <Loading />
  const idea = ideaQuery.data

  if (result) {
    return (
      <Container className="max-w-2xl py-14 sm:py-20">
        <div className="rounded-lg border border-line p-8 text-center sm:p-10" data-testid="purchase-demo-complete">
          <CircleCheck className="mx-auto size-10 text-moss" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">購入デモが完了しました</h1>
          <div className="mt-6 rounded-md border border-accent/30 bg-accent-soft px-4 py-4 text-left text-sm leading-relaxed" role="status">
            <p className="font-semibold text-ink">これは購入体験のデモです。決済は行われていません。</p>
            <p className="mt-1 text-charcoal">
              契約の締結や権利の移転も行われていません。納品物の受け渡しはデモ対象外です。記録はこのブラウザ内にのみ保存されています。
            </p>
          </div>
          <dl className="mt-6 divide-y divide-line rounded-md border border-line text-left text-sm">
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">対象</dt>
              <dd className="text-right text-ink">{result.ideaTitle}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">金額（デモ）</dt>
              <dd className="text-ink">{formatYen(result.price)}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">記録日時</dt>
              <dd className="text-ink">{formatDateTime(result.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">デモ記録ID</dt>
              <dd className="font-mono text-xs text-ink">{result.id}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink to="/account?tab=purchases">購入デモ履歴を見る</ButtonLink>
            {idea && (
              <ButtonLink to={`/connect/${idea.creatorId}?idea=${idea.id}`} variant="secondary">
                創作者に相談を申し込む
              </ButtonLink>
            )}
          </div>
        </div>
      </Container>
    )
  }

  if (!idea || idea.status !== 'published') {
    return (
      <Container className="py-20">
        <ErrorState
          title="このアイデアは現在購入できません"
          message={idea ? '非公開期間中、または公開が停止されています。' : 'アイデアが見つかりません。'}
          action={<ButtonLink to="/ideas" variant="secondary">アイデア一覧へ</ButtonLink>}
        />
      </Container>
    )
  }

  const isOwnIdea = Boolean(user.creatorId && user.creatorId === idea.creatorId)
  const allChecked = CHECKOUT_AGREEMENTS.every((a) => checked[a.key])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (isOwnIdea) {
      setError('ご自身のアイデアは購入できません。デモ利用者を「購入者」に切り替えてお試しください。')
      return
    }
    if (!allChecked) {
      setError('すべての確認項目にチェックを入れてください。')
      return
    }
    setSubmitting(true)
    try {
      // 実際の決済処理は行わない。ローカルにデモ記録を残すのみ
      await new Promise((r) => setTimeout(r, 500))
      const record = await createPurchaseDemo(idea, user.id, CHECKOUT_AGREEMENTS.map((a) => a.key))
      setResult(record)
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err instanceof DemoError ? err.message : '購入デモの記録に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container className="py-10 sm:py-14">
      <Link to={`/ideas/${idea.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        アイデア詳細へ戻る
      </Link>
      <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">購入確認（デモ）</h1>
      <div className="mt-4">
        <Notice tone="demo" title="購入体験のデモです">
          本番の決済は実装されていません。カード情報などの決済情報は入力・保存されません。
        </Notice>
      </div>

      <form onSubmit={onSubmit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]" noValidate>
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold">購入対象</h2>
            <div className="mt-4 rounded-lg border border-line p-5">
              <p className="text-xs font-medium tracking-wider text-accent">{idea.category}</p>
              <p className="mt-1 text-base font-medium text-ink">{idea.title}</p>
              <p className="mt-1 text-sm text-muted">{idea.catchcopy}</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">納品内容</h2>
            <ul className="mt-4 space-y-2">
              {idea.deliverables.map((d) => (
                <li key={d.name} className="flex gap-3 text-[15px]">
                  <FileText className="mt-1.5 size-4 shrink-0 text-muted" aria-hidden />
                  <span>
                    <span className="font-medium text-ink">{d.name}</span>
                    <span className="text-muted"> — {d.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">利用条件</h2>
            <dl className="mt-4 space-y-5">
              {PURCHASE_TERMS_SUMMARY.map((t) => (
                <div key={t.title} className="border-l-2 border-line pl-4">
                  <dt className="font-medium text-ink">{t.title}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-charcoal">{t.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <fieldset>
            <legend className="text-lg font-semibold text-ink">確認事項</legend>
            <p className="mt-1 text-sm text-muted">すべての項目を確認し、チェックを入れてください。</p>
            <div className="mt-4 space-y-3">
              {CHECKOUT_AGREEMENTS.map((a) => (
                <label key={a.key} className="flex cursor-pointer gap-3 rounded-md border border-line p-4 text-sm leading-relaxed hover:border-ink/40">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-ink"
                    checked={Boolean(checked[a.key])}
                    onChange={(e) => setChecked((c) => ({ ...c, [a.key]: e.target.checked }))}
                    name={a.key}
                  />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-line p-6">
            <h2 className="text-base font-semibold">お支払い（デモ）</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">アイデア価格</dt>
                <dd className="text-ink">{formatYen(idea.price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">初回非公開期間</dt>
                <dd className="text-ink">{NONDISCLOSURE_MONTHS}か月</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base">
                <dt className="font-medium text-ink">合計（税込）</dt>
                <dd className="font-semibold text-ink">{formatYen(idea.price)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              決済方法の選択・入力はデモ対象外です。ボタンを押しても請求は発生しません。
            </p>
            {error && (
              <p className="mt-4 rounded-md bg-rust-soft px-3 py-2 text-sm text-rust" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  記録しています…
                </>
              ) : (
                '購入デモを実行'
              )}
            </Button>
          </div>
        </aside>
      </form>
    </Container>
  )
}
