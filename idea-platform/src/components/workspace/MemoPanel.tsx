import { Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../context/toast'
import { db } from '../../db/database'
import { updateProject } from '../../db/repo'
import { formatDateTime } from '../../lib/format'
import { createId, nowIso } from '../../lib/id'
import type { KnowledgeProject } from '../../types'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/Field'
import { EmptyState } from '../ui/States'

export function MemoPanel({ project }: { project: KnowledgeProject }) {
  const { notify } = useToast()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)

  const add = async () => {
    if (!draft.trim()) {
      setError('メモを入力してください。')
      return
    }
    const now = nowIso()
    await updateProject(project.id, { memos: [{ id: createId('memo'), body: draft.trim(), createdAt: now, updatedAt: now }, ...project.memos] })
    setDraft('')
    setError('')
    notify('メモを保存しました')
  }

  const saveEdit = async () => {
    if (!editing || !editing.body.trim()) return
    await updateProject(project.id, {
      memos: project.memos.map((m) => (m.id === editing.id ? { ...m, body: editing.body.trim(), updatedAt: nowIso() } : m)),
    })
    setEditing(null)
    notify('メモを更新しました')
  }

  const remove = async (id: string) => {
    if (!window.confirm('このメモを削除しますか？')) return
    await updateProject(project.id, { memos: project.memos.filter((m) => m.id !== id) })
    notify('メモを削除しました', 'info')
  }

  const toMap = async (body: string) => {
    const count = await db.nodes.where('projectId').equals(project.id).count()
    await db.nodes.add({
      id: createId('kn'),
      projectId: project.id,
      kind: 'fact',
      label: body.slice(0, 40),
      detail: body,
      position: { x: 40 + (count % 4) * 220, y: 420 + Math.floor(count / 4) * 110 },
      updatedAt: nowIso(),
    })
    notify('「事実」ノードとして知識マップに追加しました')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <TextAreaField
          label="新しいメモ"
          rows={5}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError('')
          }}
          error={error}
          hint="気づき、観察したこと、聞いた言葉などを自由に書き留めます。"
          placeholder="例：通院の付き添いでは、待ち時間が最も長い。"
        />
        <Button onClick={() => void add()} icon={<Plus className="size-4" aria-hidden />}>
          メモを追加
        </Button>
      </div>
      <div>
        {project.memos.length === 0 ? (
          <EmptyState icon={StickyNote} title="メモはまだありません" description="思いついたことを、まずは書き留めてみましょう。" />
        ) : (
          <ul className="space-y-3" aria-label="メモ一覧">
            {project.memos.map((m) => (
              <li key={m.id} className="rounded-lg border border-line p-4">
                {editing?.id === m.id ? (
                  <div className="space-y-2">
                    <label className="sr-only" htmlFor={`memo-${m.id}`}>
                      メモを編集
                    </label>
                    <textarea
                      id={`memo-${m.id}`}
                      value={editing.body}
                      onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                      rows={4}
                      className="block w-full rounded-md border border-line-strong px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveEdit()}>
                        保存
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal">{m.body}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted">{formatDateTime(m.updatedAt)}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void toMap(m.body)}>
                          マップに追加
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ id: m.id, body: m.body })}>
                          編集
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void remove(m.id)} aria-label="メモを削除">
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
