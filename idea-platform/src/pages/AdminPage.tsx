import { ClipboardCheck, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { Container, PageHeader } from '../components/ui/PageHeader'
import { EmptyState, Loading } from '../components/ui/States'
import { TabPanel, Tabs } from '../components/ui/Tabs'
import { useDemoUser } from '../context/demoUser'
import { useToast } from '../context/toast'
import { db } from '../db/database'
import { decideReview, DemoError, setIdeaStatus } from '../db/repo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { formatDateTime, formatYen } from '../lib/format'
import { CONNECTION_STATUS_META, IDEA_STATUS_META, REVIEW_STATUS_META } from '../lib/labels'
import { REVIEW_CHECKLIST, type IdeaStatus, type ReviewChecklistKey, type ReviewRecord, type ReviewStatus } from '../types'

type TabKey = 'overview' | 'reviews' | 'ideas' | 'purchases' | 'connections' | 'activity'

export default function AdminPage() {
  useDocumentTitle('運営管理（デモ）')
  const { user, switchUser } = useDemoUser()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'overview'

  const { data } = useLiveData(async () => {
    const [ideas, reviews, purchases, connections, users, creators, activity] = await Promise.all([
      db.ideas.toArray(),
      db.reviews.reverse().sortBy('createdAt'),
      db.purchases.reverse().sortBy('createdAt'),
      db.connections.reverse().sortBy('createdAt'),
      db.users.toArray(),
      db.creators.toArray(),
      db.activity.reverse().sortBy('createdAt'),
    ])
    return { ideas, reviews, purchases, connections, users, creators, activity: activity.slice(0, 50) }
  }, [])

  const warning = (
    <Notice tone="warning" title="本番の認証・認可は実装されていません">
      この運営画面はデモです。誰でもロール切り替えで閲覧・操作できます。本番公開前に、運営者の認証、権限管理、操作の監査ログを実装する必要があります。
    </Notice>
  )

  if (user.role !== 'admin') {
    return (
      <Container className="max-w-2xl py-14">
        <PageHeader eyebrow="ADMIN (DEMO)" title="運営管理画面" />
        <div className="mt-8 space-y-6">
          {warning}
          <div className="rounded-lg border border-line p-8 text-center">
            <ShieldAlert className="mx-auto size-8 text-muted" aria-hidden />
            <p className="mt-3 font-medium text-ink">運営（デモ）ロールでのみ表示されます</p>
            <p className="mt-1 text-sm text-muted">現在のデモ利用者：{user.displayName}</p>
            <Button className="mt-5" onClick={() => switchUser('u_admin')}>
              運営（デモ）に切り替える
            </Button>
          </div>
        </div>
      </Container>
    )
  }

  if (!data) return <Loading />

  const nameOf = (userId: string) => data.users.find((u) => u.id === userId)?.displayName ?? userId
  const ideaTitle = (ideaId: string | undefined) => data.ideas.find((i) => i.id === ideaId)?.title ?? '—'
  const pending = data.reviews.filter((r) => r.status === 'pending')
  const replied = data.connections.filter((c) => c.creatorConsent !== null)
  const accepted = data.connections.filter((c) => c.status === 'accepted')

  const kpis = [
    { label: '公開中のアイデア', value: `${data.ideas.filter((i) => i.status === 'published' || i.status === 'nondisclosure').length}件` },
    { label: '審査待ち', value: `${pending.length}件` },
    { label: '購入デモ件数', value: `${data.purchases.length}件` },
    { label: 'デモ取引額（合計）', value: formatYen(data.purchases.reduce((s, p) => s + p.price, 0)) },
    { label: '相談申請', value: `${data.connections.length}件` },
    { label: '双方同意率（回答済みのうち）', value: replied.length ? `${Math.round((accepted.length / replied.length) * 100)}%` : '—' },
    { label: '登録創作者', value: `${data.creators.length}人` },
    { label: '出品済みアイデア（全状態）', value: `${data.ideas.length}件` },
  ]

  const tabs = [
    { key: 'overview' as const, label: '概要・KPI' },
    { key: 'reviews' as const, label: '出品審査', count: pending.length },
    { key: 'ideas' as const, label: '公開状態' },
    { key: 'purchases' as const, label: '購入デモ', count: data.purchases.length },
    { key: 'connections' as const, label: '相談申請', count: data.connections.length },
    { key: 'activity' as const, label: '操作履歴' },
  ]

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader eyebrow="ADMIN (DEMO)" title="運営管理画面" description="出品審査、公開状態、デモ取引、相談申請の状況を確認します。" />
      <div className="mt-6">{warning}</div>
      <div className="mt-8">
        <Tabs items={tabs} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} label="運営管理の項目" idPrefix="admin" />
        <TabPanel idPrefix="admin" tabKey={tab}>
          {tab === 'overview' && (
            <div className="space-y-8">
              <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" data-testid="kpi-grid">
                {kpis.map((k) => (
                  <div key={k.label} className="bg-white p-5">
                    <dt className="text-xs text-muted">{k.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold text-ink">{k.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">KPIはブラウザ内のデモデータから算出した値です。取引額は実際の売上ではありません。</p>
              <div>
                <h2 className="text-base font-semibold">商品品質チェックリスト</h2>
                <p className="mt-1 text-sm text-muted">出品審査で確認する項目です。すべて満たした場合のみ承認できます。</p>
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {REVIEW_CHECKLIST.map((c, i) => (
                    <li key={c.key} className="flex gap-3 rounded-md border border-line px-4 py-3 text-sm">
                      <span className="text-accent">{i + 1}</span>
                      {c.label}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {tab === 'reviews' &&
            (data.reviews.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="審査対象はありません" />
            ) : (
              <ul className="space-y-4">
                {[...pending, ...data.reviews.filter((r) => r.status !== 'pending')].map((r) => (
                  <ReviewItem key={r.id} review={r} title={ideaTitle(r.ideaId)} submitter={nameOf(r.submittedBy)} adminId={user.id} />
                ))}
              </ul>
            ))}

          {tab === 'ideas' && (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-paper text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">アイデア</th>
                    <th scope="col" className="px-4 py-3 font-medium">創作者</th>
                    <th scope="col" className="px-4 py-3 font-medium">現在の状態</th>
                    <th scope="col" className="px-4 py-3 font-medium">変更</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.ideas.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <Link to={`/ideas/${i.id}`} className="text-ink hover:underline">
                          {i.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{data.creators.find((c) => c.id === i.creatorId)?.displayName}</td>
                      <td className="px-4 py-3">
                        <Badge tone={IDEA_STATUS_META[i.status].tone}>{IDEA_STATUS_META[i.status].label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <IdeaStatusSelect ideaId={i.id} status={i.status} adminId={user.id} title={i.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'purchases' &&
            (data.purchases.length === 0 ? (
              <EmptyState title="購入デモはまだありません" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-paper text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">日時</th>
                      <th scope="col" className="px-4 py-3 font-medium">アイデア</th>
                      <th scope="col" className="px-4 py-3 font-medium">購入者（デモ）</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">金額</th>
                      <th scope="col" className="px-4 py-3 font-medium">種別</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.purchases.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(p.createdAt)}</td>
                        <td className="px-4 py-3 text-ink">{p.ideaTitle}</td>
                        <td className="px-4 py-3 text-muted">{nameOf(p.buyerId)}</td>
                        <td className="px-4 py-3 text-right text-ink">{formatYen(p.price)}</td>
                        <td className="px-4 py-3">
                          <Badge tone="brass">デモ（決済なし）</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === 'connections' &&
            (data.connections.length === 0 ? (
              <EmptyState title="相談申請はまだありません" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-paper text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">日時</th>
                      <th scope="col" className="px-4 py-3 font-medium">申請者 → 創作者</th>
                      <th scope="col" className="px-4 py-3 font-medium">目的</th>
                      <th scope="col" className="px-4 py-3 font-medium">申請者の同意</th>
                      <th scope="col" className="px-4 py-3 font-medium">創作者の同意</th>
                      <th scope="col" className="px-4 py-3 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.connections.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(c.createdAt)}</td>
                        <td className="px-4 py-3 text-ink">
                          {nameOf(c.requesterId)} → {data.creators.find((x) => x.id === c.creatorId)?.displayName}
                        </td>
                        <td className="px-4 py-3 text-muted">{c.purpose}</td>
                        <td className="px-4 py-3">{c.requesterConsent ? '同意' : '取り下げ'}</td>
                        <td className="px-4 py-3">{c.creatorConsent === null ? '未回答' : c.creatorConsent ? '同意' : '見送り'}</td>
                        <td className="px-4 py-3">
                          <Badge tone={CONNECTION_STATUS_META[c.status].tone}>{CONNECTION_STATUS_META[c.status].label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === 'activity' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">デモ用の操作履歴（最新50件）です。改ざん防止などの本番の監査ログ要件は満たしていません。</p>
              {data.activity.length === 0 ? (
                <EmptyState title="操作履歴はまだありません" />
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                  {data.activity.map((a) => (
                    <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                      <span className="shrink-0 text-xs text-muted sm:w-36">{formatDateTime(a.createdAt)}</span>
                      <span className="shrink-0 text-xs text-muted sm:w-40">{nameOf(a.actorId)}</span>
                      <span className="text-charcoal">{a.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </TabPanel>
      </div>
    </Container>
  )
}

function IdeaStatusSelect({ ideaId, status, adminId, title }: { ideaId: string; status: IdeaStatus; adminId: string; title: string }) {
  const { notify } = useToast()
  return (
    <>
      <label htmlFor={`status-${ideaId}`} className="sr-only">
        「{title}」の公開状態
      </label>
      <select
        id={`status-${ideaId}`}
        value={status}
        onChange={async (e) => {
          await setIdeaStatus(ideaId, e.target.value as IdeaStatus, adminId)
          notify('公開状態を変更しました')
        }}
        className="h-8 rounded-md border border-line-strong bg-white px-2 text-xs"
      >
        {Object.entries(IDEA_STATUS_META).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
    </>
  )
}

function ReviewItem({ review, title, submitter, adminId }: { review: ReviewRecord; title: string; submitter: string; adminId: string }) {
  const { notify } = useToast()
  const [checklist, setChecklist] = useState(review.checklist)
  const [comment, setComment] = useState(review.comment)
  const [error, setError] = useState('')
  const decided = review.status !== 'pending'
  const allChecked = Object.values(checklist).every(Boolean)

  const decide = async (decision: Exclude<ReviewStatus, 'pending'>) => {
    setError('')
    try {
      await decideReview(review.id, decision, checklist, comment, adminId)
      notify(`審査結果を記録しました：${REVIEW_STATUS_META[decision].label}`)
    } catch (e) {
      setError(e instanceof DemoError ? e.message : '記録に失敗しました。')
    }
  }

  return (
    <li className="rounded-lg border border-line p-5" data-testid="review-item">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={`/ideas/${review.ideaId}`} className="font-medium text-ink hover:underline">
            {title}
          </Link>
          <p className="text-xs text-muted">
            申請者：{submitter}・申請日時：{formatDateTime(review.createdAt)}
            {review.decidedAt && `・判定日時：${formatDateTime(review.decidedAt)}`}
          </p>
        </div>
        <Badge tone={REVIEW_STATUS_META[review.status].tone}>{REVIEW_STATUS_META[review.status].label}</Badge>
      </div>
      <fieldset disabled={decided} className="mt-4">
        <legend className="text-xs font-medium text-muted">品質チェックリスト</legend>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {REVIEW_CHECKLIST.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-ink"
                checked={checklist[c.key as ReviewChecklistKey]}
                onChange={(e) => setChecklist((s) => ({ ...s, [c.key]: e.target.checked }))}
              />
              {c.label}
            </label>
          ))}
        </div>
        <label htmlFor={`comment-${review.id}`} className="mt-4 block text-xs font-medium text-muted">
          審査コメント（差し戻し・却下の場合は必須）
        </label>
        <textarea
          id={`comment-${review.id}`}
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full rounded-md border border-line-strong px-3 py-2 text-sm disabled:bg-paper"
        />
      </fieldset>
      {error && (
        <p className="mt-3 rounded-md bg-rust-soft px-3 py-2 text-sm text-rust" role="alert">
          {error}
        </p>
      )}
      {!decided && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void decide('approved')} aria-describedby={allChecked ? undefined : `hint-${review.id}`}>
            承認して公開
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void decide('changes_requested')}>
            差し戻す
          </Button>
          <Button size="sm" variant="danger" onClick={() => void decide('rejected')}>
            却下する
          </Button>
          {!allChecked && (
            <span id={`hint-${review.id}`} className="self-center text-xs text-muted">
              承認にはすべての項目の確認が必要です
            </span>
          )}
        </div>
      )}
    </li>
  )
}
