import { ExternalLink, Link as LinkIcon, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useToast } from '../../context/toast'
import { db } from '../../db/database'
import { addSource, deleteSource } from '../../db/repo'
import { useLiveData } from '../../hooks/useLiveData'
import { formatDate, isSafeHttpUrl } from '../../lib/format'
import { SOURCE_KIND_LABEL } from '../../lib/labels'
import type { SourceKind } from '../../types'
import { Button } from '../ui/Button'
import { SelectField, TextAreaField, TextField } from '../ui/Field'
import { EmptyState, Loading } from '../ui/States'

export function SourcePanel({ projectId }: { projectId: string }) {
  const { notify } = useToast()
  const { data: sources } = useLiveData(() => db.sources.where('projectId').equals(projectId).reverse().sortBy('createdAt'), [projectId])
  const [form, setForm] = useState({ title: '', kind: 'web' as SourceKind, url: '', note: '' })
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!form.title.trim()) next.title = 'タイトルを入力してください。'
    if (form.url.trim() && !isSafeHttpUrl(form.url.trim())) next.url = 'http:// または https:// で始まるURLを入力してください。'
    setErrors(next)
    if (Object.keys(next).length) return
    await addSource({ projectId, title: form.title.trim(), kind: form.kind, url: form.url.trim() || undefined, note: form.note.trim() })
    setForm({ title: '', kind: form.kind, url: '', note: '' })
    notify('情報ソースを登録しました')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="タイトル" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} placeholder="例：家計調査（総務省）の該当表" />
        <SelectField label="種類" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SourceKind })}>
          {Object.entries(SOURCE_KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
        <TextField
          label="URL（任意）"
          type="url"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          error={errors.url}
          hint="URLは記録のみで、アプリが自動でアクセスすることはありません。"
          placeholder="https://"
        />
        <TextAreaField label="メモ" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} hint="個人を特定できる情報や、第三者の秘密情報は記録しないでください。" />
        <Button type="submit" icon={<Plus className="size-4" aria-hidden />}>
          情報ソースを登録
        </Button>
      </form>
      <div>
        {!sources ? (
          <Loading />
        ) : sources.length === 0 ? (
          <EmptyState icon={LinkIcon} title="情報ソースはまだありません" description="調べた資料やヒアリングの記録を登録すると、IIPの根拠資料に引用できます。" />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line" aria-label="情報ソース一覧">
            {sources.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs text-accent">{SOURCE_KIND_LABEL[s.kind]}</p>
                  <p className="text-sm font-medium break-words text-ink">{s.title}</p>
                  {s.url && isSafeHttpUrl(s.url) && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-xs break-all text-muted underline underline-offset-2 hover:text-ink">
                      {s.url}
                      <ExternalLink className="size-3 shrink-0" aria-label="（外部サイトを新しいタブで開く）" />
                    </a>
                  )}
                  {s.note && <p className="mt-1 text-xs whitespace-pre-wrap text-muted">{s.note}</p>}
                  <p className="mt-1 text-[11px] text-muted">登録日 {formatDate(s.createdAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`「${s.title}」を削除`}
                  onClick={async () => {
                    if (!window.confirm('この情報ソースを削除しますか？')) return
                    await deleteSource(s.id)
                    notify('情報ソースを削除しました', 'info')
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
