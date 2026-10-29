import { Download, FileText, FolderOpen, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { TextAreaField, TextField } from '../components/ui/Field'
import { Notice } from '../components/ui/Notice'
import { Container, PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../components/ui/States'
import { TabPanel, Tabs } from '../components/ui/Tabs'
import { HypothesisPanel } from '../components/workspace/HypothesisPanel'
import KnowledgeMap from '../components/workspace/KnowledgeMap'
import { MemoPanel } from '../components/workspace/MemoPanel'
import { SourcePanel } from '../components/workspace/SourcePanel'
import { StructurePanel } from '../components/workspace/StructurePanel'
import { useDemoUser } from '../context/demoUser'
import { useToast } from '../context/toast'
import { BackupError, exportProject, importProject, parseJsonText } from '../db/backup'
import { db } from '../db/database'
import { createBlankPackage, createProject, deleteProject, updateProject } from '../db/repo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { dateStamp, downloadJson } from '../lib/download'
import { formatDateTime } from '../lib/format'
import type { KnowledgeProject } from '../types'

type TabKey = 'map' | 'memo' | 'sources' | 'hypotheses' | 'structure'

export default function WorkspacePage() {
  useDocumentTitle('知識創造ワークスペース')
  const { user } = useDemoUser()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const projectsQuery = useLiveData(() => db.projects.where('ownerId').equals(user.id).reverse().sortBy('updatedAt'), [user.id])
  const projects = projectsQuery.data
  const selectedId = params.get('project') ?? projects?.[0]?.id ?? ''
  const project = projects?.find((p) => p.id === selectedId)
  const tab = (params.get('tab') as TabKey) || 'map'

  const select = (id: string, nextTab: TabKey = 'map') => setParams({ project: id, tab: nextTab }, { replace: false })

  const onImport = async (file: File | undefined) => {
    setImportError('')
    if (!file) return
    try {
      const data = parseJsonText(await file.text())
      const id = await importProject(data, user.id)
      notify('プロジェクトをインポートしました')
      select(id)
    } catch (e) {
      setImportError(e instanceof BackupError ? e.message : 'インポートに失敗しました。')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="WORKSPACE"
        title="知識創造ワークスペース"
        description="メモ・情報ソース・知識マップで考えを整理し、仮説と反証を検討して、IIP（アイデア情報パッケージ）にまとめます。"
        actions={
          <>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} icon={<Upload className="size-4" aria-hidden />}>
              インポート
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="プロジェクトのJSONファイルを選択"
              data-testid="project-import-input"
              onChange={(e) => void onImport(e.target.files?.[0])}
            />
            <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
              新規プロジェクト
            </Button>
          </>
        }
      />

      <div className="mt-6 space-y-3">
        {importError && <ErrorState title="インポートできませんでした" message={importError} />}
        {creating && (
          <NewProjectForm
            onCancel={() => setCreating(false)}
            onCreate={async (title, description) => {
              const id = await createProject(user.id, title, description)
              setCreating(false)
              notify('プロジェクトを作成しました')
              select(id)
            }}
          />
        )}
      </div>

      {projectsQuery.loading ? (
        <Loading />
      ) : !projects || projects.length === 0 ? (
        !creating && (
          <div className="mt-8">
            <EmptyState
              icon={FolderOpen}
              title="プロジェクトはまだありません"
              description="考えたいテーマごとにプロジェクトを作成します。データはこのブラウザ内に保存されます。"
              action={
                <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
                  最初のプロジェクトを作成
                </Button>
              }
            />
          </div>
        )
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* プロジェクト一覧 */}
          <nav aria-label="プロジェクト一覧">
            <div className="lg:hidden">
              <label htmlFor="project-select" className="text-xs text-muted">
                プロジェクト
              </label>
              <select
                id="project-select"
                value={selectedId}
                onChange={(e) => select(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <ul className="hidden space-y-1 lg:block">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p.id)}
                    aria-current={p.id === selectedId ? 'true' : undefined}
                    className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      p.id === selectedId ? 'bg-paper font-medium text-ink' : 'text-charcoal hover:bg-paper'
                    }`}
                  >
                    <span className="line-clamp-2">{p.title}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-muted">更新 {formatDateTime(p.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 hidden lg:block">
              <Button
                variant="ghost"
                size="sm"
                icon={<FileText className="size-3.5" aria-hidden />}
                onClick={async () => {
                  const id = await createBlankPackage(user.id)
                  navigate(`/workspace/iip/${id}`)
                }}
              >
                白紙からIIPを作成
              </Button>
            </div>
          </nav>

          {/* プロジェクト本体 */}
          <div className="min-w-0">
            {project ? (
              <ProjectView key={project.id} project={project} tab={tab} onTab={(t) => select(project.id, t)} />
            ) : (
              <ErrorState title="プロジェクトが見つかりません" action={<Button variant="secondary" onClick={() => setParams({})}>一覧に戻る</Button>} />
            )}
          </div>
        </div>
      )}
    </Container>
  )
}

function NewProjectForm({ onCreate, onCancel }: { onCreate: (title: string, description: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 2) {
      setError('タイトルを2文字以上で入力してください。')
      return
    }
    await onCreate(title, description)
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line p-5" noValidate aria-label="新規プロジェクト">
      <TextField label="プロジェクト名" required value={title} onChange={(e) => setTitle(e.target.value)} error={error} maxLength={60} autoFocus placeholder="例：商店街の空き店舗を学びの場に" />
      <TextAreaField label="説明（任意）" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      <div className="flex gap-2">
        <Button type="submit">作成する</Button>
        <Button variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}

function ProjectView({ project, tab, onTab }: { project: KnowledgeProject; tab: TabKey; onTab: (t: TabKey) => void }) {
  const { user } = useDemoUser()
  const { notify } = useToast()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description)
  const { data: counts } = useLiveData(
    async () => ({
      sources: await db.sources.where('projectId').equals(project.id).count(),
      hypotheses: await db.nodes.where('projectId').equals(project.id).filter((n) => n.kind === 'hypothesis').count(),
    }),
    [project.id],
  )
  const { data: packages } = useLiveData(() => db.packages.where('projectId').equals(project.id).toArray(), [project.id])

  const tabs = [
    { key: 'map' as const, label: '知識マップ' },
    { key: 'memo' as const, label: 'メモ', count: project.memos.length },
    { key: 'sources' as const, label: '情報ソース', count: counts?.sources },
    { key: 'hypotheses' as const, label: '仮説・反証', count: counts?.hypotheses },
    { key: 'structure' as const, label: '構造化・IIP' },
  ]

  const exportJson = async () => {
    const data = await exportProject(project.id)
    downloadJson(`project-${dateStamp()}.json`, data)
    notify('JSONファイルを書き出しました')
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {editing ? (
          <form
            className="flex-1 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (title.trim().length < 2) return
              await updateProject(project.id, { title: title.trim(), description: description.trim() })
              setEditing(false)
              notify('プロジェクト情報を更新しました')
            }}
          >
            <TextField label="プロジェクト名" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} error={title.trim().length < 2 ? '2文字以上で入力してください。' : undefined} />
            <TextAreaField label="説明" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                保存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                キャンセル
              </Button>
            </div>
          </form>
        ) : (
          <div className="min-w-0">
            <h2 className="text-xl font-semibold" data-testid="project-title">
              {project.title}
            </h2>
            {project.description && <p className="mt-1 text-sm text-muted">{project.description}</p>}
          </div>
        )}
        {!editing && (
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} icon={<Pencil className="size-3.5" aria-hidden />}>
              編集
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void exportJson()} icon={<Download className="size-3.5" aria-hidden />}>
              JSONエクスポート
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-3.5" aria-hidden />}
              onClick={async () => {
                if (!window.confirm(`「${project.title}」を削除しますか？ 知識マップ・メモ・情報ソースも削除されます（IIPは残ります）。`)) return
                await deleteProject(project.id)
                notify('プロジェクトを削除しました', 'info')
              }}
            >
              削除
            </Button>
          </div>
        )}
      </div>

      {packages && packages.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">このプロジェクトのIIP：</span>
          {packages.map((p) => (
            <Link key={p.id} to={`/workspace/iip/${p.id}`} className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-0.5 hover:border-ink">
              {p.title || '（無題）'}
              <Badge tone={p.status === 'submitted' ? 'brass' : 'slate'}>{p.status === 'submitted' ? '申請済み' : '下書き'}</Badge>
            </Link>
          ))}
        </div>
      )}

      {user.role === 'buyer' && tab === 'structure' && (
        <div className="mt-4">
          <Notice tone="info">出品審査の申請は「創作者」のデモ利用者で行えます。IIPの作成とプレビューはどの利用者でも試せます。</Notice>
        </div>
      )}

      <div className="mt-6">
        <Tabs items={tabs} value={tab} onChange={onTab} label="ワークスペースの機能" idPrefix="ws" />
        <TabPanel idPrefix="ws" tabKey={tab}>
          {tab === 'map' && <KnowledgeMap project={project} />}
          {tab === 'memo' && <MemoPanel project={project} />}
          {tab === 'sources' && <SourcePanel projectId={project.id} />}
          {tab === 'hypotheses' && <HypothesisPanel projectId={project.id} />}
          {tab === 'structure' && <StructurePanel project={project} />}
        </TabPanel>
      </div>
    </div>
  )
}
