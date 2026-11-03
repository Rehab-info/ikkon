import { CircleHelp, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../context/toast'
import { db } from '../../db/database'
import { useLiveData } from '../../hooks/useLiveData'
import { createId, nowIso } from '../../lib/id'
import { NODE_KIND_META, VERDICT_META } from '../../lib/labels'
import type { HypothesisVerdict, KnowledgeNode } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState, Loading } from '../ui/States'

/** 仮説ごとに、根拠（支持）と反証を一覧・追加する */
export function HypothesisPanel({ projectId }: { projectId: string }) {
  const { notify } = useToast()
  const { data } = useLiveData(
    async () => ({
      nodes: await db.nodes.where('projectId').equals(projectId).toArray(),
      edges: await db.edges.where('projectId').equals(projectId).toArray(),
    }),
    [projectId],
  )
  const [newHypothesis, setNewHypothesis] = useState('')

  if (!data) return <Loading />
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const hypotheses = data.nodes.filter((n) => n.kind === 'hypothesis')

  const linked = (h: KnowledgeNode, relation: 'supports' | 'refutes') =>
    data.edges
      .filter((e) => e.relation === relation && (e.target === h.id || e.source === h.id))
      .map((e) => byId.get(e.target === h.id ? e.source : e.target))
      .filter((n): n is KnowledgeNode => Boolean(n))

  const addLinked = async (h: KnowledgeNode, kind: 'evidence' | 'counter', label: string) => {
    const id = createId('kn')
    const now = nowIso()
    await db.transaction('rw', db.nodes, db.edges, async () => {
      await db.nodes.add({
        id,
        projectId,
        kind,
        label,
        detail: '',
        position: { x: h.position.x + (kind === 'evidence' ? -240 : 240), y: h.position.y + 120 },
        updatedAt: now,
      })
      await db.edges.add({ id: createId('ke'), projectId, source: id, target: h.id, relation: kind === 'evidence' ? 'supports' : 'refutes' })
    })
    notify(`${NODE_KIND_META[kind].label}を追加しました（知識マップにも反映）`)
  }

  const addHypothesis = async () => {
    if (!newHypothesis.trim()) return
    await db.nodes.add({
      id: createId('kn'),
      projectId,
      kind: 'hypothesis',
      label: newHypothesis.trim(),
      detail: '',
      position: { x: 280 + (hypotheses.length % 3) * 40, y: 200 + hypotheses.length * 40 },
      verdict: 'open',
      updatedAt: nowIso(),
    })
    setNewHypothesis('')
    notify('仮説を追加しました')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="new-hypothesis" className="sr-only">
          新しい仮説
        </label>
        <input
          id="new-hypothesis"
          value={newHypothesis}
          onChange={(e) => setNewHypothesis(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void addHypothesis()
          }}
          placeholder="新しい仮説（例：待ち時間だけ交代できれば負担が減る）"
          className="h-10 flex-1 rounded-md border border-line-strong px-3 text-sm focus:border-ink focus:outline-none"
        />
        <Button onClick={() => void addHypothesis()} icon={<Plus className="size-4" aria-hidden />} disabled={!newHypothesis.trim()}>
          仮説を追加
        </Button>
      </div>

      {hypotheses.length === 0 ? (
        <EmptyState icon={CircleHelp} title="仮説はまだありません" description="検証が必要な見立てを「仮説」として書き出し、根拠と反証を集めましょう。" />
      ) : (
        <ul className="space-y-4">
          {hypotheses.map((h) => (
            <HypothesisCard key={h.id} hypothesis={h} supports={linked(h, 'supports')} refutes={linked(h, 'refutes')} onAdd={addLinked} />
          ))}
        </ul>
      )}
    </div>
  )
}

function HypothesisCard({
  hypothesis,
  supports,
  refutes,
  onAdd,
}: {
  hypothesis: KnowledgeNode
  supports: KnowledgeNode[]
  refutes: KnowledgeNode[]
  onAdd: (h: KnowledgeNode, kind: 'evidence' | 'counter', label: string) => Promise<void>
}) {
  const [drafts, setDrafts] = useState({ evidence: '', counter: '' })
  const verdict = hypothesis.verdict ?? 'open'
  return (
    <li className="rounded-lg border border-line p-5" data-testid="hypothesis-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium" style={{ color: NODE_KIND_META.hypothesis.color }}>
            仮説
          </p>
          <p className="mt-0.5 font-medium text-ink">{hypothesis.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={VERDICT_META[verdict].tone}>{VERDICT_META[verdict].label}</Badge>
          <label className="sr-only" htmlFor={`verdict-${hypothesis.id}`}>
            判定を変更
          </label>
          <select
            id={`verdict-${hypothesis.id}`}
            value={verdict}
            onChange={(e) => void db.nodes.update(hypothesis.id, { verdict: e.target.value as HypothesisVerdict, updatedAt: nowIso() })}
            className="h-8 rounded-md border border-line-strong bg-white px-2 text-xs"
          >
            {Object.entries(VERDICT_META).map(([k, v]) => (
              <option key={k} value={k}>
                判定：{v.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(
          [
            ['evidence', '根拠', supports],
            ['counter', '反証', refutes],
          ] as const
        ).map(([kind, label, list]) => (
          <div key={kind} className="rounded-md p-3" style={{ background: NODE_KIND_META[kind].tint }}>
            <p className="text-xs font-medium" style={{ color: NODE_KIND_META[kind].color }}>
              {label}（{list.length}）
            </p>
            {list.length === 0 ? (
              <p className="mt-1 text-xs text-muted">まだありません</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-charcoal">
                {list.map((n) => (
                  <li key={n.id}>{n.label}</li>
                ))}
              </ul>
            )}
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={async (e) => {
                e.preventDefault()
                const value = drafts[kind].trim()
                if (!value) return
                await onAdd(hypothesis, kind, value)
                setDrafts((d) => ({ ...d, [kind]: '' }))
              }}
            >
              <label className="sr-only" htmlFor={`${kind}-${hypothesis.id}`}>
                {label}を追加
              </label>
              <input
                id={`${kind}-${hypothesis.id}`}
                value={drafts[kind]}
                onChange={(e) => setDrafts((d) => ({ ...d, [kind]: e.target.value }))}
                placeholder={`${label}を追加`}
                className="h-8 min-w-0 flex-1 rounded border border-line-strong bg-white px-2 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={!drafts[kind].trim()}>
                追加
              </Button>
            </form>
          </div>
        ))}
      </div>
    </li>
  )
}
