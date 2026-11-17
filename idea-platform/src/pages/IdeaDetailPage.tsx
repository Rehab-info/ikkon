import { ArrowLeft, Check, FileText, Lock, MessageCircle } from 'lucide-react'
import { lazy, Suspense, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IdeaStatusBadge } from '../components/idea/IdeaStatusBadge'
import { SaveIdeaButton } from '../components/idea/SaveIdeaButton'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { Container } from '../components/ui/PageHeader'
import { ErrorState, Loading } from '../components/ui/States'
import { PURCHASE_TERMS_SUMMARY } from '../content/terms'
import { useDemoUser } from '../context/demoUser'
import { db } from '../db/database'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { formatDate, formatYen } from '../lib/format'
import { canViewFullIdea, toPublicPreview } from '../lib/ideaAccess'
import { CONSULTATION_META, IDEA_STATUS_META, NODE_KIND_META, VALIDATION_STAGE_META } from '../lib/labels'
import { NODE_KINDS, type Idea } from '../types'

const KnowledgeMapPreview = lazy(() => import('../components/idea/KnowledgeMapPreview'))

/** 購入後に開示される項目（購入前の画面には名前だけを示す） */
const LOCKED_SECTIONS = ['概要', '解決する課題の詳細', '既存手段との差異', '調査・検証の内容', '知識マップ', '納品物の中身（IIPなど）']

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 text-[15px] leading-loose text-charcoal">{children}</div>
    </section>
  )
}

/** 購入者・創作者本人・運営だけに表示する詳細 */
function FullContent({ idea }: { idea: Idea }) {
  const usedKinds = NODE_KINDS.filter((k) => idea.sampleMap.nodes.some((n) => n.kind === k))
  return (
    <>
      <Block title="概要">
        <p>{idea.summary}</p>
      </Block>
      <Block title="解決する課題">
        <p>{idea.problem}</p>
      </Block>
      <Block title="既存手段との差異">
        <p>{idea.differentiation}</p>
      </Block>
      <Block title="調査・検証の内容">
        <ul className="space-y-2">
          {idea.validation.activities.map((a) => (
            <li key={a} className="flex gap-2.5 text-[15px]">
              <Check className="mt-1.5 size-4 shrink-0 text-moss" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
      </Block>
      <Block title="納品物の内容">
        <ul className="divide-y divide-line rounded-lg border border-line">
          {idea.deliverables.map((d) => (
            <li key={d.name} className="flex gap-3 px-4 py-3.5">
              <FileText className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-ink">{d.name}</p>
                <p className="text-sm text-muted">{d.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">{idea.hiddenNotice} 納品物ファイルの受け渡しはデモ対象外です。</p>
      </Block>
      <Block title="知識マップ（概要）">
        {idea.sampleMap.nodes.length > 0 ? (
          <>
            <Suspense fallback={<Loading label="知識マップを読み込み中…" />}>
              <KnowledgeMapPreview map={idea.sampleMap} />
            </Suspense>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="ノード種別の凡例">
              {usedKinds.map((k) => {
                const meta = NODE_KIND_META[k]
                const Icon = meta.icon
                return (
                  <li key={k} className="flex items-center gap-1">
                    <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
                    {meta.label}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">知識マップは添付されていません。</p>
        )}
      </Block>
    </>
  )
}

export default function IdeaDetailPage() {
  const { id = '' } = useParams()
  const { user } = useDemoUser()
  const ideaQuery = useLiveData(() => db.ideas.get(id), [id])
  const raw = ideaQuery.data
  const { data: creator } = useLiveData(() => (raw ? db.creators.get(raw.creatorId) : Promise.resolve(undefined)), [raw?.creatorId])
  const purchaseQuery = useLiveData(
    () => db.purchases.where('buyerId').equals(user.id).filter((p) => p.ideaId === id).first(),
    [user.id, id],
  )
  const myPurchase = purchaseQuery.data
  useDocumentTitle(raw?.title ?? 'アイデア詳細')

  if (ideaQuery.loading || purchaseQuery.loading) return <Loading />

  const isOwner = Boolean(raw && user.creatorId && raw.creatorId === user.creatorId)
  const isPublic = raw && (raw.status === 'published' || raw.status === 'nondisclosure')
  if (!raw || (!isPublic && !isOwner && user.role !== 'admin')) {
    return (
      <Container className="py-20">
        <ErrorState
          title="アイデアが見つかりません"
          message="削除されたか、現在公開されていない可能性があります。"
          action={<ButtonLink to="/ideas" variant="secondary">アイデア一覧へ戻る</ButtonLink>}
        />
      </Container>
    )
  }

  // 画面には公開範囲の値だけを使い、詳細は閲覧できる場合にのみ FullContent へ渡す
  const idea = toPublicPreview(raw)
  const fullAccess = canViewFullIdea(raw, user, Boolean(myPurchase))
  const stage = VALIDATION_STAGE_META[idea.validationStage]
  const canPurchase = idea.status === 'published'
  const accessReason = myPurchase
    ? `${formatDate(myPurchase.createdAt)}に購入デモを実行したため、購入者向けの内容を表示しています。`
    : isOwner
      ? 'あなたが創作者のため、購入者向けの内容を表示しています。'
      : '運営（デモ）として、購入者向けの内容を表示しています。'

  return (
    <Container className="py-10 sm:py-14">
      <Link to="/ideas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        アイデア一覧
      </Link>

      {!isPublic && (
        <div className="mt-6">
          <Notice tone="warning" title="このアイデアは一般公開されていません">
            {IDEA_STATUS_META[idea.status].description} 創作者本人または運営（デモ）として閲覧しています。
          </Notice>
        </div>
      )}

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium tracking-wider text-accent">{idea.category}</span>
              <IdeaStatusBadge status={idea.status} />
              {idea.tags.map((t) => (
                <Badge key={t} tone="outline">
                  {t}
                </Badge>
              ))}
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-snug sm:text-[32px] sm:leading-snug">{idea.title}</h1>
            <p className="mt-4 text-base text-charcoal">{idea.catchcopy}</p>
            <p className="mt-4 text-xs text-muted">
              公開日 {formatDate(idea.publishedAt)}・更新日 {formatDate(idea.updatedAt)}
            </p>
          </header>

          <div className="mt-10 space-y-10">
            <Block title="想定顧客">
              <p>{idea.targetCustomers}</p>
            </Block>
            <Block title="検証の段階">
              <div className="flex items-center gap-3">
                <span className="flex gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={`h-1.5 w-8 rounded-full ${i <= stage.step ? 'bg-ink' : 'bg-line'}`} />
                  ))}
                </span>
                <span className="text-sm font-medium text-ink">
                  {stage.label}（4段階中{stage.step}）
                </span>
              </div>
            </Block>
            <Block title="納品物">
              <ul className="flex flex-wrap gap-2">
                {idea.deliverableNames.map((name) => (
                  <li key={name} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink">
                    <FileText className="size-3.5 text-muted" aria-hidden />
                    {name}
                  </li>
                ))}
              </ul>
            </Block>

            {fullAccess ? (
              <>
                <Notice tone="demo" title="購入者向けの内容">
                  {accessReason}
                </Notice>
                <FullContent idea={raw} />
              </>
            ) : (
              <section className="rounded-lg border border-line bg-paper p-6 sm:p-8" aria-labelledby="locked-heading" data-testid="locked-content">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-ink" aria-hidden />
                  <h2 id="locked-heading" className="text-lg font-semibold">
                    アイデアの中身は購入後に開示されます
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-charcoal">
                  創作者のアイデアを守るため、購入前に公開しているのは紹介文・想定顧客・検証の段階・納品物の名前だけです。
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {LOCKED_SECTIONS.map((name) => (
                    <li key={name} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2.5 text-sm text-muted">
                      <Lock className="size-3.5 shrink-0" aria-hidden />
                      {name}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs leading-relaxed text-muted">
                  購入前に確かめたいことがあれば、創作者に相談を申し込むこともできます（創作者の同意が必要です）。
                </p>
              </section>
            )}
          </div>
        </article>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-line p-6">
            <p className="text-xs text-muted">価格（税込・デモ）</p>
            <p className="mt-1 text-3xl font-semibold text-ink">{formatYen(idea.price)}</p>
            <p className="mt-3 text-sm text-muted">{IDEA_STATUS_META[idea.status].description}</p>
            {myPurchase && (
              <p className="mt-3 rounded bg-moss-soft px-3 py-2 text-xs text-moss">
                {formatDate(myPurchase.createdAt)}に購入デモを実行済みです（決済は行われていません）。
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              {canPurchase ? (
                <ButtonLink to={`/checkout/${idea.id}`} size="lg">
                  購入手続きへ（デモ）
                </ButtonLink>
              ) : (
                <p className="rounded-md border border-line bg-paper px-3 py-2.5 text-center text-sm text-muted" role="note">
                  現在、購入を受け付けていません
                </p>
              )}
              <SaveIdeaButton ideaId={idea.id} title={idea.title} withLabel />
            </div>
          </div>

          <div className="rounded-lg border border-line p-6">
            <h2 className="text-base font-semibold">購入条件（概要）</h2>
            <dl className="mt-4 space-y-4 text-sm">
              {PURCHASE_TERMS_SUMMARY.map((t) => (
                <div key={t.title}>
                  <dt className="font-medium text-ink">{t.title}</dt>
                  <dd className="mt-1 leading-relaxed text-muted">{t.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">※ 条件は法務確認前の叩き台（デモ表記）です。</p>
          </div>

          {creator && (
            <div className="rounded-lg border border-line p-6">
              <p className="text-xs font-medium tracking-wider text-accent">このアイデアを生み出した人</p>
              <div className="mt-4 flex items-center gap-3">
                <Avatar creator={creator} />
                <div>
                  <p className="font-medium text-ink">{creator.displayName}</p>
                  <Badge tone={CONSULTATION_META[creator.consultation].tone}>{CONSULTATION_META[creator.consultation].label}</Badge>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-charcoal">{creator.tagline}</p>
              <div className="mt-5 flex flex-col gap-2">
                <ButtonLink to={`/creators/${creator.id}`} variant="secondary">
                  プロフィールを見る
                </ButtonLink>
                {creator.consultation !== 'closed' && (
                  <ButtonLink to={`/connect/${creator.id}?idea=${idea.id}`} variant="ghost" icon={<MessageCircle className="size-4" aria-hidden />}>
                    この人に相談を申し込む
                  </ButtonLink>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </Container>
  )
}
