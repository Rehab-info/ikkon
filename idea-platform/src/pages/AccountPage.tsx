import { Bookmark, Download, FolderOpen, Inbox, MessageCircle, RotateCcw, ShoppingBag, Store, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IdeaCard } from '../components/idea/IdeaCard'
import { IdeaStatusBadge } from '../components/idea/IdeaStatusBadge'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { Container, PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { TabPanel, Tabs } from '../components/ui/Tabs'
import { useDemoUser } from '../context/demoUser'
import { useToast } from '../context/toast'
import { BackupError, exportAll, importAll, parseJsonText } from '../db/backup'
import { db } from '../db/database'
import { logActivity, replyConnection, withdrawConnection } from '../db/repo'
import { seedDemoData } from '../db/seed'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { dateStamp, downloadJson } from '../lib/download'
import { formatDateTime, formatYen } from '../lib/format'
import { CONNECTION_STATUS_META, REVIEW_STATUS_META, ROLE_LABEL } from '../lib/labels'
import type { ConnectionRequest, User } from '../types'

type TabKey = 'saved' | 'purchases' | 'listings' | 'connections' | 'inbox' | 'projects' | 'data'

export default function AccountPage() {
  useDocumentTitle('マイページ')
  const { user } = useDemoUser()
  const [params, setParams] = useSearchParams()
  const isCreator = Boolean(user.creatorId)

  const { data: counts } = useLiveData(
    async () => ({
      saved: await db.saved.where('userId').equals(user.id).count(),
      purchases: await db.purchases.where('buyerId').equals(user.id).count(),
      listings: await db.packages.where('ownerId').equals(user.id).count(),
      connections: await db.connections.where('requesterId').equals(user.id).count(),
      inbox: user.creatorId ? await db.connections.where('creatorId').equals(user.creatorId).count() : 0,
      projects: await db.projects.where('ownerId').equals(user.id).count(),
    }),
    [user.id, user.creatorId],
  )

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'saved', label: '保存したアイデア', count: counts?.saved },
    { key: 'purchases', label: '購入デモ履歴', count: counts?.purchases },
    { key: 'connections', label: '相談申請履歴', count: counts?.connections },
    ...(isCreator ? [{ key: 'inbox' as const, label: '受信した相談', count: counts?.inbox }] : []),
    { key: 'listings', label: '出品デモ履歴', count: counts?.listings },
    { key: 'projects', label: '創作プロジェクト', count: counts?.projects },
    { key: 'data', label: 'データ管理' },
  ]
  const requested = params.get('tab') as TabKey | null
  const tab: TabKey = requested && tabs.some((t) => t.key === requested) ? requested : 'saved'

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="MY PAGE"
        title="マイページ"
        description={
          <>
            <span className="font-medium text-ink">{user.displayName}</span>
            <Badge tone="outline" className="ml-2">
              {ROLE_LABEL[user.role]}
            </Badge>
            <span className="mt-1 block text-sm">{user.description}</span>
          </>
        }
      />
      <div className="mt-6">
        <Notice tone="demo">ログイン機能は実装されていません。ヘッダーの切り替えで、購入者・創作者・運営のデモ表示を確認できます。</Notice>
      </div>
      <div className="mt-8">
        <Tabs items={tabs} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} label="マイページの項目" idPrefix="account" />
        <TabPanel idPrefix="account" tabKey={tab}>
          {tab === 'saved' && <SavedTab user={user} />}
          {tab === 'purchases' && <PurchasesTab user={user} />}
          {tab === 'connections' && <ConnectionsTab user={user} />}
          {tab === 'inbox' && <InboxTab user={user} />}
          {tab === 'listings' && <ListingsTab user={user} />}
          {tab === 'projects' && <ProjectsTab user={user} />}
          {tab === 'data' && <DataTab user={user} />}
        </TabPanel>
      </div>
    </Container>
  )
}

function SavedTab({ user }: { user: User }) {
  const { data } = useLiveData(async () => {
    const saved = await db.saved.where('userId').equals(user.id).toArray()
    const ideas = (await db.ideas.bulkGet(saved.map((s) => s.ideaId))).filter((i) => i !== undefined)
    const creators = await db.creators.toArray()
    return { ideas, creators }
  }, [user.id])
  if (!data) return <Loading />
  if (data.ideas.length === 0) {
    return <EmptyState icon={Bookmark} title="保存したアイデアはありません" description="アイデアカードのしおりボタンで保存できます。" action={<ButtonLink to="/ideas">アイデアを探す</ButtonLink>} />
  }
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {data.ideas.map((i) => (
        <IdeaCard key={i.id} idea={i} creator={data.creators.find((c) => c.id === i.creatorId)} />
      ))}
    </div>
  )
}

function PurchasesTab({ user }: { user: User }) {
  const { data } = useLiveData(() => db.purchases.where('buyerId').equals(user.id).reverse().sortBy('createdAt'), [user.id])
  if (!data) return <Loading />
  if (data.length === 0) return <EmptyState icon={ShoppingBag} title="購入デモの履歴はありません" action={<ButtonLink to="/ideas">アイデアを探す</ButtonLink>} />
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">すべてデモの記録です。決済・契約締結・権利移転は行われていません。</p>
      <ul className="divide-y divide-line rounded-lg border border-line" data-testid="purchase-list">
        {data.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to={`/ideas/${p.ideaId}`} className="font-medium text-ink hover:underline">
                {p.ideaTitle}
              </Link>
              <p className="text-xs text-muted">
                {formatDateTime(p.createdAt)}・非公開期間 {p.nondisclosureMonths}か月（デモ）
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="brass">デモ</Badge>
              <span className="text-sm font-medium text-ink">{formatYen(p.price)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConnectionRow({ c, title, children }: { c: ConnectionRequest; title: React.ReactNode; children?: React.ReactNode }) {
  const meta = CONNECTION_STATUS_META[c.status]
  return (
    <li className="space-y-3 p-5" data-testid="connection-row">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium text-ink">{title}</div>
          <p className="text-xs text-muted">
            {formatDateTime(c.createdAt)}・{c.purpose}・{c.collaboration}
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-paper px-3 py-2 text-sm text-charcoal">{c.message}</p>
      <p className="text-xs text-muted">
        同意状況：申請者 {c.requesterConsent ? '同意' : '取り下げ'}／創作者 {c.creatorConsent === null ? '未回答' : c.creatorConsent ? '同意' : '見送り'}
      </p>
      {c.creatorReply && <p className="text-sm text-charcoal">創作者からの返答：{c.creatorReply}</p>}
      {c.status === 'accepted' && (
        <Notice tone="demo">
          双方の同意が成立しました。本番では、この後にサービス内の安全なメッセージ機能で対話を始める想定です（デモ対象外）。連絡先はこのプロトタイプでは表示しません。
        </Notice>
      )}
      {children}
    </li>
  )
}

function ConnectionsTab({ user }: { user: User }) {
  const { notify } = useToast()
  const { data } = useLiveData(async () => {
    const list = await db.connections.where('requesterId').equals(user.id).reverse().sortBy('createdAt')
    const creators = await db.creators.toArray()
    return { list, creators }
  }, [user.id])
  if (!data) return <Loading />
  if (data.list.length === 0) return <EmptyState icon={MessageCircle} title="相談申請の履歴はありません" description="気になるアイデアの創作者プロフィールから申し込めます。" />
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {data.list.map((c) => {
        const creator = data.creators.find((x) => x.id === c.creatorId)
        return (
          <ConnectionRow key={c.id} c={c} title={<Link to={`/creators/${c.creatorId}`} className="hover:underline">{creator?.displayName ?? '不明な創作者'}さんへの相談</Link>}>
            {c.status === 'pending' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (!window.confirm('この相談申請を取り下げますか？')) return
                  await withdrawConnection(c.id, user.id)
                  notify('申請を取り下げました', 'info')
                }}
              >
                申請を取り下げる
              </Button>
            )}
          </ConnectionRow>
        )
      })}
    </ul>
  )
}

function InboxTab({ user }: { user: User }) {
  const { data } = useLiveData(async () => {
    const list = await db.connections.where('creatorId').equals(user.creatorId ?? '').reverse().sortBy('createdAt')
    const users = await db.users.toArray()
    const ideas = await db.ideas.toArray()
    return { list, users, ideas }
  }, [user.creatorId])
  if (!data) return <Loading />
  if (data.list.length === 0) return <EmptyState icon={Inbox} title="受信した相談はありません" />
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {data.list.map((c) => {
        const from = data.users.find((u) => u.id === c.requesterId)
        const idea = data.ideas.find((i) => i.id === c.ideaId)
        return (
          <ConnectionRow key={c.id} c={c} title={<>{from?.displayName ?? '申請者'}{idea && <span className="text-sm font-normal text-muted">（対象：{idea.title}）</span>}</>}>
            {c.status === 'pending' && <ReplyForm id={c.id} actorId={user.id} />}
          </ConnectionRow>
        )
      })}
    </ul>
  )
}

function ReplyForm({ id, actorId }: { id: string; actorId: string }) {
  const { notify } = useToast()
  const [reply, setReply] = useState('')
  return (
    <div className="space-y-2">
      <label htmlFor={`reply-${id}`} className="text-xs text-muted">
        返答メッセージ（任意・連絡先は書かないでください）
      </label>
      <textarea id={`reply-${id}`} rows={2} value={reply} onChange={(e) => setReply(e.target.value)} className="block w-full rounded-md border border-line-strong px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await replyConnection(id, actorId, true, reply)
            notify('承諾しました。双方同意が成立しました（デモ）')
          }}
        >
          承諾する（同意）
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await replyConnection(id, actorId, false, reply)
            notify('今回は見送りました', 'info')
          }}
        >
          今回は見送る
        </Button>
      </div>
    </div>
  )
}

function ListingsTab({ user }: { user: User }) {
  const { data } = useLiveData(async () => {
    const packages = await db.packages.where('ownerId').equals(user.id).reverse().sortBy('updatedAt')
    const ideas = await db.ideas.toArray()
    const reviews = await db.reviews.toArray()
    return { packages, ideas, reviews }
  }, [user.id])
  if (!data) return <Loading />
  if (data.packages.length === 0) {
    return <EmptyState icon={Store} title="出品デモの履歴はありません" description="ワークスペースでIIPを作成し、出品審査を申請できます。" action={<ButtonLink to="/workspace">ワークスペースへ</ButtonLink>} />
  }
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {data.packages.map((p) => {
        const idea = data.ideas.find((i) => i.id === p.submittedIdeaId)
        const review = data.reviews.filter((r) => r.packageId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        return (
          <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to={`/workspace/iip/${p.id}`} className="font-medium text-ink hover:underline">
                {p.title || '（無題のIIP）'}
              </Link>
              <p className="text-xs text-muted">更新 {formatDateTime(p.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={p.status === 'submitted' ? 'brass' : 'slate'}>{p.status === 'submitted' ? '申請済み' : '下書き'}</Badge>
              {review && <Badge tone={REVIEW_STATUS_META[review.status].tone}>審査：{REVIEW_STATUS_META[review.status].label}</Badge>}
              {idea && <IdeaStatusBadge status={idea.status} />}
              {idea && (idea.status === 'published' || idea.status === 'nondisclosure') && (
                <Link to={`/ideas/${idea.id}`} className="text-xs text-ink underline underline-offset-2">
                  公開ページ
                </Link>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ProjectsTab({ user }: { user: User }) {
  const { data } = useLiveData(() => db.projects.where('ownerId').equals(user.id).reverse().sortBy('updatedAt'), [user.id])
  if (!data) return <Loading />
  if (data.length === 0) {
    return <EmptyState icon={FolderOpen} title="創作プロジェクトはありません" action={<ButtonLink to="/workspace">ワークスペースで作成</ButtonLink>} />
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {data.map((p) => (
        <li key={p.id}>
          <Link to={`/workspace?project=${p.id}`} className="block rounded-lg border border-line p-5 hover:border-ink/40">
            <p className="font-medium text-ink">{p.title}</p>
            {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
            <p className="mt-3 text-xs text-muted">
              メモ {p.memos.length}件・更新 {formatDateTime(p.updatedAt)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function DataTab({ user }: { user: User }) {
  const { notify } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const exportBackup = async () => {
    const data = await exportAll()
    downloadJson(`idea-platform-backup-${dateStamp()}.json`, data)
    notify('バックアップを書き出しました')
  }

  const restore = async (file: File | undefined) => {
    setError('')
    if (!file) return
    try {
      const data = parseJsonText(await file.text())
      if (!window.confirm('現在のブラウザ内のデータを、バックアップの内容で置き換えます。よろしいですか？')) return
      setBusy(true)
      await importAll(data)
      await logActivity(user.id, 'backup_import', 'all', 'バックアップから復元')
      notify('バックアップから復元しました')
    } catch (e) {
      setError(e instanceof BackupError ? e.message : '復元に失敗しました。')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const reset = async () => {
    if (!window.confirm('すべてのデータを初期のデモデータに戻します。作成したプロジェクトや履歴は削除されます。よろしいですか？')) return
    setBusy(true)
    await seedDemoData()
    await logActivity(user.id, 'demo_reset', 'all', 'デモデータを初期化')
    setBusy(false)
    notify('デモデータを初期状態に戻しました')
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="rounded-lg border border-line p-6">
        <Download className="size-5 text-ink" aria-hidden />
        <h3 className="mt-3 font-semibold">バックアップを書き出す</h3>
        <p className="mt-1 text-sm text-muted">ブラウザ内のすべてのデータ（プロジェクト・履歴など）をJSONファイルに保存します。</p>
        <Button className="mt-4" variant="secondary" onClick={() => void exportBackup()}>
          JSONで書き出す
        </Button>
      </div>
      <div className="rounded-lg border border-line p-6">
        <Upload className="size-5 text-ink" aria-hidden />
        <h3 className="mt-3 font-semibold">バックアップから復元</h3>
        <p className="mt-1 text-sm text-muted">書き出したJSONファイルを読み込み、データを置き換えます。形式を検証してから復元します。</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="バックアップファイルを選択" data-testid="backup-import-input" onChange={(e) => void restore(e.target.files?.[0])} />
        <Button className="mt-4" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          ファイルを選択
        </Button>
      </div>
      <div className="rounded-lg border border-line p-6">
        <RotateCcw className="size-5 text-ink" aria-hidden />
        <h3 className="mt-3 font-semibold">デモデータを初期化</h3>
        <p className="mt-1 text-sm text-muted">すべてのデータを削除し、初期のデモデータに戻します。</p>
        <Button className="mt-4" variant="danger" disabled={busy} onClick={() => void reset()}>
          初期化する
        </Button>
      </div>
      {error && (
        <div className="md:col-span-3">
          <ErrorState title="復元できませんでした" message={error} />
        </div>
      )}
      <p className="text-xs text-muted md:col-span-3">データはこのブラウザの IndexedDB にのみ保存されています。ブラウザのデータを消去すると失われるため、定期的なバックアップをおすすめします。</p>
    </div>
  )
}
