import { FileText, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoUser } from '../../context/demoUser'
import { useToast } from '../../context/toast'
import { db } from '../../db/database'
import { createPackageFromProject, updateProject } from '../../db/repo'
import { useLiveData } from '../../hooks/useLiveData'
import { NODE_KIND_META } from '../../lib/labels'
import { NODE_KINDS, type KnowledgeProject, type NodeKind, type ProjectStructure } from '../../types'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/Field'
import { SaveStatus, type SaveState } from '../ui/States'

const FIELDS: Array<{ key: keyof ProjectStructure; label: string; from: NodeKind[]; hint: string }> = [
  { key: 'problem', label: '解決する課題', from: ['problem'], hint: '誰が、どの場面で、何に困っているか' },
  { key: 'customer', label: '想定顧客', from: [], hint: 'このアイデアに価値を感じ、対価を払うのは誰か' },
  { key: 'solution', label: '解決策', from: ['solution', 'idea'], hint: '課題をどう解くか' },
  { key: 'differentiation', label: '既存手段との差異', from: [], hint: '今ある方法と何が違うか' },
  { key: 'evidence', label: '根拠', from: ['evidence', 'fact'], hint: '主張を支える事実・データ' },
]

export function StructurePanel({ project }: { project: KnowledgeProject }) {
  const { user } = useDemoUser()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectStructure>(project.structure)
  const [state, setState] = useState<SaveState>('idle')
  const { data: nodes } = useLiveData(() => db.nodes.where('projectId').equals(project.id).toArray(), [project.id])

  const set = (key: keyof ProjectStructure, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setState('dirty')
  }

  const importFromMap = () => {
    if (!nodes) return
    const next = { ...form }
    let filled = 0
    for (const f of FIELDS) {
      if (next[f.key].trim() || f.from.length === 0) continue
      const lines = nodes.filter((n) => f.from.includes(n.kind)).map((n) => `・${n.label}`)
      if (lines.length) {
        next[f.key] = lines.join('\n')
        filled++
      }
    }
    setForm(next)
    setState('dirty')
    notify(filled ? `${filled}項目をマップから取り込みました（未保存）` : '取り込める空欄がありませんでした', 'info')
  }

  const save = async () => {
    setState('saving')
    try {
      await updateProject(project.id, { structure: form })
      setState('saved')
    } catch {
      setState('error')
    }
  }

  const createIip = async () => {
    await updateProject(project.id, { structure: form })
    const id = await createPackageFromProject(project.id, user.id)
    notify('IIPの下書きを作成しました')
    navigate(`/workspace/iip/${id}`)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">知識マップを、アイデアの骨格（5つの問い）に整理します。</p>
          <SaveStatus state={state} />
        </div>
        {FIELDS.map((f) => (
          <TextAreaField key={f.key} label={f.label} hint={f.hint} rows={3} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={state === 'saving'}>
            構造化の内容を保存
          </Button>
          <Button variant="secondary" onClick={importFromMap} icon={<Wand2 className="size-4" aria-hidden />}>
            空欄をマップから取り込む
          </Button>
        </div>
        <div className="rounded-lg border border-line bg-paper p-5">
          <p className="font-medium text-ink">IIP（アイデア情報パッケージ）を作成</p>
          <p className="mt-1 text-sm text-muted">構造化の内容・知識マップ・情報ソースを引き継いだ下書きを作成し、IIP作成画面に移動します。</p>
          <Button className="mt-4" variant="accent" onClick={() => void createIip()} icon={<FileText className="size-4" aria-hidden />}>
            このプロジェクトからIIPを作成
          </Button>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">マップの要素（種別ごと）</p>
        <div className="mt-3 space-y-3">
          {NODE_KINDS.map((k) => {
            const list = (nodes ?? []).filter((n) => n.kind === k)
            if (list.length === 0) return null
            const meta = NODE_KIND_META[k]
            return (
              <div key={k} className="rounded-md border-l-4 py-1 pl-3" style={{ borderColor: meta.color }}>
                <p className="text-xs font-medium" style={{ color: meta.color }}>
                  {meta.label}（{list.length}）
                </p>
                <ul className="mt-0.5 space-y-0.5 text-sm text-charcoal">
                  {list.map((n) => (
                    <li key={n.id}>{n.label}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
