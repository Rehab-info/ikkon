import { ArrowLeft, FileCode, Lock, Printer, Send } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IdeaStatusBadge } from '../components/idea/IdeaStatusBadge'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { SelectField, TextAreaField, TextField } from '../components/ui/Field'
import { Notice } from '../components/ui/Notice'
import { Container } from '../components/ui/PageHeader'
import { ErrorState, Loading, SaveStatus, type SaveState } from '../components/ui/States'
import { TabPanel, Tabs } from '../components/ui/Tabs'
import { useDemoUser } from '../context/demoUser'
import { useToast } from '../context/toast'
import { STANDARD_PRICE } from '../data/seed'
import { db } from '../db/database'
import { DemoError, submitPackageForReview, updatePackage, validatePackageForSubmission } from '../db/repo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { dateStamp, downloadText } from '../lib/download'
import { formatYen } from '../lib/format'
import { buildIipHtml } from '../lib/iipHtml'
import { IIP_SECTION_META, NODE_KIND_META, REVIEW_STATUS_META } from '../lib/labels'
import { IDEA_CATEGORIES, IIP_SECTION_KEYS, NODE_KINDS, type IdeaCategory, type IdeaPackage, type SampleMap } from '../types'

const KnowledgeMapPreview = lazy(() => import('../components/idea/KnowledgeMapPreview'))
const AUTOSAVE_MS = 600

type Editable = Pick<IdeaPackage, 'title' | 'category' | 'catchcopy' | 'targetCustomers' | 'sections' | 'linkedNodeIds'>

export default function IipPage() {
  const { id = '' } = useParams()
  const { user } = useDemoUser()
  const pkgQuery = useLiveData(() => db.packages.get(id), [id])
  const pkg = pkgQuery.data
  useDocumentTitle(pkg?.title ? `IIP：${pkg.title}` : 'IIP作成')

  if (pkgQuery.loading) return <Loading />
  if (!pkg) {
    return (
      <Container className="py-20">
        <ErrorState title="IIPが見つかりません" action={<ButtonLink to="/workspace" variant="secondary">ワークスペースへ</ButtonLink>} />
      </Container>
    )
  }
  if (pkg.ownerId !== user.id) {
    return (
      <Container className="py-20">
        <ErrorState
          title="このIIPは別のデモ利用者のものです"
          message="作成したデモ利用者に切り替えると編集できます。"
          action={<ButtonLink to="/workspace" variant="secondary">ワークスペースへ</ButtonLink>}
        />
      </Container>
    )
  }
  return <IipEditor key={pkg.id} pkg={pkg} />
}

function IipEditor({ pkg }: { pkg: IdeaPackage }) {
  const { user } = useDemoUser()
  const { notify } = useToast()
  const [form, setForm] = useState<Editable>(() => ({
    title: pkg.title,
    category: pkg.category,
    catchcopy: pkg.catchcopy,
    targetCustomers: pkg.targetCustomers,
    sections: pkg.sections,
    linkedNodeIds: pkg.linkedNodeIds,
  }))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [previewTab, setPreviewTab] = useState<'document' | 'product'>('document')
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [submitErrors, setSubmitErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<Editable | null>(null)

  const locked = pkg.status === 'submitted'
  const { data: projectNodes } = useLiveData(
    () => (pkg.projectId ? db.nodes.where('projectId').equals(pkg.projectId).toArray() : Promise.resolve([])),
    [pkg.projectId],
  )
  const { data: projectEdges } = useLiveData(
    () => (pkg.projectId ? db.edges.where('projectId').equals(pkg.projectId).toArray() : Promise.resolve([])),
    [pkg.projectId],
  )
  const { data: idea } = useLiveData(() => (pkg.submittedIdeaId ? db.ideas.get(pkg.submittedIdeaId) : Promise.resolve(undefined)), [pkg.submittedIdeaId])
  const { data: latestReview } = useLiveData(
    () => (pkg.submittedIdeaId ? db.reviews.where('ideaId').equals(pkg.submittedIdeaId).reverse().sortBy('createdAt').then((r) => r[0]) : Promise.resolve(undefined)),
    [pkg.submittedIdeaId],
  )

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const data = pending.current
    if (!data) return
    pending.current = null
    setSaveState('saving')
    try {
      await updatePackage(pkg.id, data)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [pkg.id])

  useEffect(() => () => void flush(), [flush])

  const change = (next: Editable) => {
    if (locked) return
    setForm(next)
    pending.current = next
    setSaveState('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }

  const sampleMap: SampleMap = {
    nodes: (projectNodes ?? []).filter((n) => form.linkedNodeIds.includes(n.id)).map((n) => ({ id: n.id, kind: n.kind, label: n.label, x: n.position.x, y: n.position.y })),
    edges: (projectEdges ?? [])
      .filter((e) => form.linkedNodeIds.includes(e.source) && form.linkedNodeIds.includes(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, relation: e.relation })),
  }

  const submit = async () => {
    await flush()
    const current = { ...pkg, ...form }
    const errors = validatePackageForSubmission(current)
    setSubmitErrors(errors)
    if (errors.length) return
    if (!user.creatorId) {
      setSubmitErrors(['出品審査の申請は「創作者」のデモ利用者でのみ行えます。ヘッダーのデモ利用者切り替えから変更してください。'])
      return
    }
    setSubmitting(true)
    try {
      await submitPackageForReview(current, user)
      notify('出品審査を申請しました（デモ）。運営画面で確認できます。')
    } catch (e) {
      setSubmitErrors([e instanceof DemoError ? e.message : '申請に失敗しました。'])
    } finally {
      setSubmitting(false)
    }
  }

  const exportHtml = () => {
    downloadText(`iip-${dateStamp()}.html`, buildIipHtml({ ...pkg, ...form }, user.displayName), 'text/html')
    notify('HTMLファイルを書き出しました')
  }

  return (
    <Container className="py-10 sm:py-14">
      <div className="print:hidden">
        <Link to={pkg.projectId ? `/workspace?project=${pkg.projectId}&tab=structure` : '/workspace'} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          ワークスペースへ戻る
        </Link>
        <div className="mt-6 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-accent">IIP — IDEA INFORMATION PACKAGE</p>
            <h1 className="mt-2 text-2xl font-semibold">IIP（アイデア情報パッケージ）の作成</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge tone={locked ? 'brass' : 'slate'}>{locked ? '審査申請済み' : '下書き'}</Badge>
              {idea && <IdeaStatusBadge status={idea.status} />}
              {!locked && <SaveStatus state={saveState} />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer className="size-3.5" aria-hidden />}>
              印刷
            </Button>
            <Button variant="secondary" size="sm" onClick={exportHtml} icon={<FileCode className="size-3.5" aria-hidden />}>
              HTML出力
            </Button>
            <span className="inline-flex items-center rounded-md border border-dashed border-line-strong px-3 text-xs text-muted" title="PDF出力は初期実装の対象外です">
              PDF出力（準備中）
            </span>
          </div>
        </div>

        {locked && (
          <div className="mt-6">
            <Notice tone="demo" title="出品審査を申請済みです（デモ）">
              審査中は編集できません。運営（デモ）が差し戻すと、再び編集できるようになります。
              {latestReview && (
                <span className="mt-1 block">
                  最新の審査状況：{REVIEW_STATUS_META[latestReview.status].label}
                  {latestReview.comment && `（コメント：${latestReview.comment}）`}
                </span>
              )}
            </Notice>
          </div>
        )}
        {!locked && latestReview?.status === 'changes_requested' && (
          <div className="mt-6">
            <Notice tone="warning" title="運営から差し戻されました">
              {latestReview.comment}
            </Notice>
          </div>
        )}

        <div className="mt-6 flex gap-2 lg:hidden" role="group" aria-label="表示の切り替え">
          {(
            [
              ['edit', '編集'],
              ['preview', 'プレビュー'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mobileView === k}
              onClick={() => setMobileView(k)}
              className={`h-9 flex-1 rounded-md border text-sm ${mobileView === k ? 'border-ink bg-ink text-white' : 'border-line-strong text-charcoal'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 print:mt-0 print:block">
        {/* 入力 */}
        <div className={`space-y-6 print:hidden ${mobileView === 'edit' ? '' : 'hidden lg:block'}`}>
          <fieldset disabled={locked} className="space-y-5">
            <legend className="sr-only">基本情報</legend>
            <TextField label="タイトル" required value={form.title} maxLength={60} onChange={(e) => change({ ...form, title: e.target.value })} />
            <TextField
              label="一文紹介"
              required
              value={form.catchcopy}
              maxLength={80}
              hint="一覧のカードに表示されます。核心情報は書かないでください。"
              onChange={(e) => change({ ...form, catchcopy: e.target.value })}
            />
            <SelectField label="カテゴリー" value={form.category} onChange={(e) => change({ ...form, category: e.target.value as IdeaCategory })}>
              {IDEA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <TextAreaField label="想定顧客" required rows={2} value={form.targetCustomers} onChange={(e) => change({ ...form, targetCustomers: e.target.value })} />
            {IIP_SECTION_KEYS.map((key) => (
              <TextAreaField
                key={key}
                label={IIP_SECTION_META[key].label}
                required={['overview', 'customerProblem', 'proposal', 'risks', 'validationPlan'].includes(key)}
                rows={4}
                placeholder={IIP_SECTION_META[key].placeholder}
                value={form.sections[key]}
                onChange={(e) => change({ ...form, sections: { ...form.sections, [key]: e.target.value } })}
              />
            ))}
          </fieldset>

          <section className="rounded-lg border border-line p-5" aria-labelledby="map-link-heading">
            <h2 id="map-link-heading" className="text-base font-semibold">
              知識マップとの連携
            </h2>
            {!pkg.projectId ? (
              <p className="mt-2 text-sm text-muted">このIIPはプロジェクトに連携していません（白紙から作成、または元のプロジェクトが削除されました）。</p>
            ) : !projectNodes || projectNodes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">連携しているプロジェクトにノードがありません。</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">購入前に公開する「サンプル知識マップ」に含めるノードを選びます。核心情報を含むノードは選ばないでください。</p>
                <fieldset disabled={locked} className="mt-4 space-y-1.5">
                  <legend className="sr-only">サンプル知識マップに含めるノード</legend>
                  {NODE_KINDS.flatMap((k) => projectNodes.filter((n) => n.kind === k)).map((n) => {
                    const meta = NODE_KIND_META[n.kind]
                    return (
                      <label key={n.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-ink"
                          checked={form.linkedNodeIds.includes(n.id)}
                          onChange={(e) =>
                            change({
                              ...form,
                              linkedNodeIds: e.target.checked ? [...form.linkedNodeIds, n.id] : form.linkedNodeIds.filter((x) => x !== n.id),
                            })
                          }
                        />
                        <span className="w-16 shrink-0 text-xs" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="text-charcoal">{n.label}</span>
                      </label>
                    )
                  })}
                </fieldset>
              </>
            )}
          </section>

          {!locked && (
            <section className="rounded-lg border border-line bg-paper p-5" aria-labelledby="submit-heading">
              <h2 id="submit-heading" className="text-base font-semibold">
                出品審査を申請（デモ）
              </h2>
              <p className="mt-1 text-sm text-muted">申請すると運営の審査一覧に追加されます。実際の出品・公開は行われません（運営デモ画面で承認すると、このプロトタイプ内でのみ公開されます）。</p>
              {submitErrors.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 rounded-md bg-rust-soft py-3 pr-3 pl-7 text-sm text-rust" role="alert" data-testid="iip-errors">
                  {submitErrors.map((e) => (
                    <li key={e} className="whitespace-pre-line">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              <Button className="mt-4" onClick={() => void submit()} disabled={submitting} icon={<Send className="size-4" aria-hidden />}>
                {submitting ? '申請しています…' : '出品審査を申請する'}
              </Button>
            </section>
          )}
        </div>

        {/* プレビュー */}
        <div className={`${mobileView === 'preview' ? '' : 'hidden lg:block'} print:block`}>
          <div className="lg:sticky lg:top-24">
            <div className="print:hidden">
              <Tabs<'document' | 'product'>
                items={[
                  { key: 'document' as const, label: 'IIP文書' },
                  { key: 'product' as const, label: '商品ページでの見え方' },
                ]}
                value={previewTab}
                onChange={setPreviewTab}
                label="プレビューの種類"
                idPrefix="iip-preview"
              />
            </div>
            <TabPanel idPrefix="iip-preview" tabKey={previewTab}>
              {previewTab === 'document' ? (
                <IipDocument form={form} author={user.displayName} />
              ) : (
                <ProductPreview form={form} sampleMap={sampleMap} />
              )}
            </TabPanel>
          </div>
        </div>
      </div>
    </Container>
  )
}

function Paragraphs({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-line-strong">（未記入）</p>
  return <p className="whitespace-pre-wrap">{text.trim()}</p>
}

function IipDocument({ form, author }: { form: Editable; author: string }) {
  return (
    <article className="max-h-[75vh] overflow-y-auto rounded-lg border border-line bg-white p-6 text-[14px] leading-relaxed sm:p-8 print:max-h-none print:overflow-visible print:border-0 print:p-0" data-testid="iip-preview">
      <p className="text-[11px] tracking-[0.15em] text-accent">IIP — アイデア情報パッケージ</p>
      <h2 className="mt-2 text-xl font-semibold">{form.title || '（タイトル未入力）'}</h2>
      {form.catchcopy && <p className="mt-2 text-muted">{form.catchcopy}</p>}
      <p className="mt-2 text-xs text-muted">
        カテゴリー：{form.category}／作成者：{author}
      </p>
      <section className="mt-6 border-t border-line pt-4">
        <h3 className="text-sm font-semibold">想定顧客</h3>
        <div className="mt-1 text-charcoal">
          <Paragraphs text={form.targetCustomers} />
        </div>
      </section>
      {IIP_SECTION_KEYS.map((key) => (
        <section key={key} className="mt-5 border-t border-line pt-4 print:break-inside-avoid">
          <h3 className="text-sm font-semibold">{IIP_SECTION_META[key].label}</h3>
          <div className="mt-1 text-charcoal">
            <Paragraphs text={form.sections[key]} />
          </div>
        </section>
      ))}
      <p className="mt-8 border-t border-line pt-4 text-[11px] text-muted">
        プロトタイプで作成した文書です。数値・調査結果は作成者の仮説を含みます。特許権などの権利を示すものではありません。
      </p>
    </article>
  )
}

function ProductPreview({ form, sampleMap }: { form: Editable; sampleMap: SampleMap }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">審査で承認されると、アイデア詳細ページには次の範囲が表示されます。</p>
      <div className="rounded-lg border border-line p-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-wider text-accent">{form.category}</span>
          <Badge tone="ink">購入受付中</Badge>
        </div>
        <p className="mt-3 text-[17px] font-semibold text-ink">{form.title || '（タイトル未入力）'}</p>
        <p className="mt-2 text-sm text-muted">{form.catchcopy || '（一文紹介未入力）'}</p>
        <p className="mt-4 text-right text-sm font-semibold text-ink">{formatYen(STANDARD_PRICE)}</p>
      </div>
      <dl className="space-y-3 text-sm">
        {(
          [
            ['公開：概要', form.sections.overview],
            ['公開：解決する課題', form.sections.customerProblem],
            ['公開：想定顧客', form.targetCustomers],
            ['公開：既存手段との差異', form.sections.competition],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium text-moss">{k}</dt>
            <dd className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-charcoal">{v || '（未記入）'}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-3 rounded-lg bg-paper px-4 py-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-muted">提案内容・市場調査・根拠資料・財務仮説・リスク・検証計画は、購入後の納品物にのみ含まれます。</p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-moss">公開：サンプル知識マップ（{sampleMap.nodes.length}ノード）</p>
        {sampleMap.nodes.length > 0 ? (
          <Suspense fallback={<Loading />}>
            <KnowledgeMapPreview map={sampleMap} height={280} />
          </Suspense>
        ) : (
          <p className="text-sm text-muted">ノードが選択されていません。</p>
        )}
      </div>
    </div>
  )
}
