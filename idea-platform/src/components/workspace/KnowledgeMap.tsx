import {
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Save, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getAssistant, type AssistantSuggestion } from '../../ai/assistant'
import { db } from '../../db/database'
import { saveGraph } from '../../db/repo'
import { createId, nowIso } from '../../lib/id'
import { EDGE_RELATION_LABEL, NODE_KIND_META, VERDICT_META } from '../../lib/labels'
import {
  NODE_KINDS,
  type EdgeRelation,
  type HypothesisVerdict,
  type KnowledgeEdge,
  type KnowledgeNode,
  type KnowledgeProject,
  type NodeKind,
} from '../../types'
import { Button } from '../ui/Button'
import { Loading, SaveStatus, type SaveState } from '../ui/States'
import { edgeAppearance, type KnowledgeFlowEdge, type KnowledgeFlowNode } from './flow'
import { nodeTypes } from './nodeTypes'

const AUTOSAVE_MS = 700

function toFlowNode(n: KnowledgeNode): KnowledgeFlowNode {
  return { id: n.id, type: 'knowledge', position: n.position, data: { kind: n.kind, label: n.label, detail: n.detail, verdict: n.verdict } }
}
function toFlowEdge(e: KnowledgeEdge): KnowledgeFlowEdge {
  return { id: e.id, source: e.source, target: e.target, data: { relation: e.relation }, ...edgeAppearance(e.relation) }
}

/** 接続元のノード種別から関係を推定する */
function guessRelation(sourceKind: NodeKind | undefined): EdgeRelation {
  if (sourceKind === 'evidence') return 'supports'
  if (sourceKind === 'counter') return 'refutes'
  if (sourceKind === 'plan' || sourceKind === 'solution') return 'leads'
  return 'relates'
}

interface Props {
  project: KnowledgeProject
}

export default function KnowledgeMap(props: Props) {
  return (
    <ReactFlowProvider>
      <KnowledgeMapInner {...props} />
    </ReactFlowProvider>
  )
}

function KnowledgeMapInner({ project }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<KnowledgeFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<KnowledgeFlowEdge>([])
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<string>()
  const [selection, setSelection] = useState<{ nodeId?: string; edgeId?: string }>({})
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[] | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rf = useReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>()

  // 保存処理で最新の状態を参照するための ref
  const latest = useRef({ nodes, edges })
  useEffect(() => {
    latest.current = { nodes, edges }
  }, [nodes, edges])
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 初回読み込み（編集中はローカル状態を正とし、保存時にDBへ書き戻す）
  useEffect(() => {
    let cancelled = false
    Promise.all([db.nodes.where('projectId').equals(project.id).toArray(), db.edges.where('projectId').equals(project.id).toArray()]).then(
      ([n, e]) => {
        if (cancelled) return
        setNodes(n.map(toFlowNode))
        setEdges(e.map(toFlowEdge))
        setLoaded(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [project.id, setNodes, setEdges])

  const persist = useCallback(async () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    setSaveState('saving')
    const now = nowIso()
    const { nodes: ns, edges: es } = latest.current
    try {
      await saveGraph(
        project.id,
        ns.map((n) => ({
          id: n.id,
          projectId: project.id,
          kind: n.data.kind,
          label: n.data.label,
          detail: n.data.detail ?? '',
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
          verdict: n.data.kind === 'hypothesis' ? (n.data.verdict ?? 'open') : undefined,
          updatedAt: now,
        })),
        es.map((e) => ({ id: e.id, projectId: project.id, source: e.source, target: e.target, relation: e.data?.relation ?? 'relates' })),
      )
      setSaveState('saved')
      setSavedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {
      dirty.current = true
      setSaveState('error')
    }
  }, [project.id])

  const markDirty = useCallback(() => {
    dirty.current = true
    setSaveState('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void persist(), AUTOSAVE_MS)
  }, [persist])

  // タブ切り替え・画面遷移時に未保存分を書き込む
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void persist()
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      void persist()
    }
  }, [persist])

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) return
      const sourceKind = latest.current.nodes.find((n) => n.id === c.source)?.data.kind
      const relation = guessRelation(sourceKind)
      setEdges((eds) => addEdge({ ...c, id: createId('ke'), data: { relation }, ...edgeAppearance(relation) }, eds))
      markDirty()
    },
    [setEdges, markDirty],
  )

  const addNode = useCallback(
    (kind: NodeKind, label?: string) => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      const center = rect
        ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 100, y: 100 }
      const offset = (latest.current.nodes.length % 5) * 18
      const id = createId('kn')
      const node: KnowledgeFlowNode = {
        id,
        type: 'knowledge',
        position: { x: center.x - 100 + offset, y: center.y - 30 + offset },
        data: { kind, label: label ?? `新しい${NODE_KIND_META[kind].label}`, detail: '', verdict: kind === 'hypothesis' ? 'open' : undefined },
        selected: true,
      }
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node])
      setSelection({ nodeId: id })
      markDirty()
    },
    [rf, setNodes, markDirty],
  )

  const updateNodeData = (id: string, patch: Partial<KnowledgeFlowNode['data']>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    markDirty()
  }
  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setSelection({})
    markDirty()
  }
  const updateEdgeRelation = (id: string, relation: EdgeRelation) => {
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, data: { relation }, ...edgeAppearance(relation) } : e)))
    markDirty()
  }
  const deleteEdge = (id: string) => {
    setEdges((es) => es.filter((e) => e.id !== id))
    setSelection({})
    markDirty()
  }

  const onSelectionChange = useCallback(({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
    setSelection({ nodeId: ns[0]?.id, edgeId: ns[0] ? undefined : es[0]?.id })
  }, [])

  const runAssistant = async () => {
    const result = await getAssistant().review({
      project,
      nodes: latest.current.nodes.map((n) => ({
        id: n.id,
        projectId: project.id,
        kind: n.data.kind,
        label: n.data.label,
        detail: n.data.detail ?? '',
        position: n.position,
        verdict: n.data.verdict,
        updatedAt: '',
      })),
      edges: latest.current.edges.map((e) => ({ id: e.id, projectId: project.id, source: e.source, target: e.target, relation: e.data?.relation ?? 'relates' })),
    })
    setSuggestions(result)
  }

  const selectedNode = nodes.find((n) => n.id === selection.nodeId)
  const selectedEdge = edges.find((e) => e.id === selection.edgeId)

  if (!loaded) return <Loading label="知識マップを読み込み中…" />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="toolbar" aria-label="ノードを追加">
          {NODE_KINDS.map((kind) => {
            const meta = NODE_KIND_META[kind]
            const Icon = meta.icon
            return (
              <button
                key={kind}
                type="button"
                onClick={() => addNode(kind)}
                title={`${meta.label}を追加：${meta.hint}`}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs text-ink hover:bg-paper"
                style={{ borderColor: `${meta.color}55` }}
              >
                <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />+ {meta.label}
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SaveStatus state={saveState} savedAt={savedAt} />
          <Button size="sm" variant="secondary" onClick={() => void persist()} icon={<Save className="size-3.5" aria-hidden />} disabled={saveState === 'saving'}>
            保存
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div ref={wrapperRef} className="h-[60vh] min-h-[420px] overflow-hidden rounded-lg border border-line bg-white" data-testid="knowledge-map">
          <ReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              onNodesChange(changes)
              if (changes.some((c) => c.type === 'position' || c.type === 'remove')) markDirty()
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes)
              if (changes.some((c) => c.type === 'remove')) markDirty()
            }}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={['Delete', 'Backspace']}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
            minZoom={0.3}
          >
            <Background gap={24} color="#eceef1" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable className="!hidden sm:!block" nodeColor={(n) => NODE_KIND_META[(n.data as KnowledgeFlowNode['data']).kind].color} />
          </ReactFlow>
        </div>

        <aside className="space-y-4" aria-label="選択中の要素">
          <div className="rounded-lg border border-line p-4">
            {selectedNode ? (
              <NodeInspector
                key={selectedNode.id}
                node={selectedNode}
                onChange={(patch) => updateNodeData(selectedNode.id, patch)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            ) : selectedEdge ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">接続線</p>
                <label className="block text-xs text-muted">
                  関係
                  <select
                    value={selectedEdge.data?.relation ?? 'relates'}
                    onChange={(e) => updateEdgeRelation(selectedEdge.id, e.target.value as EdgeRelation)}
                    className="mt-1 block h-9 w-full rounded-md border border-line-strong bg-white px-2 text-sm text-charcoal"
                  >
                    {Object.entries(EDGE_RELATION_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <Button size="sm" variant="danger" onClick={() => deleteEdge(selectedEdge.id)} icon={<Trash2 className="size-3.5" aria-hidden />}>
                  接続を削除
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted">
                <p className="font-medium text-ink">使い方</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                  <li>上のボタンでノードを追加</li>
                  <li>ノードをドラッグして移動</li>
                  <li>ノードの丸い点から別のノードへ線を引いて接続</li>
                  <li>ノードや線をクリックするとここで編集</li>
                  <li>Delete キーで選択中の要素を削除</li>
                  <li>変更は自動で保存されます</li>
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">構造の点検</p>
              <Button size="sm" variant="ghost" onClick={() => void runAssistant()} icon={<Sparkles className="size-3.5" aria-hidden />}>
                点検する
              </Button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {getAssistant().name}。{getAssistant().sendsDataExternally ? `送信先：${getAssistant().destination}` : 'データは外部に送信されません。'}AI連携は準備中です。
            </p>
            {suggestions && (
              <ul className="mt-3 space-y-2" aria-live="polite">
                {suggestions.map((s) => (
                  <li key={s.id} className={`rounded-md px-3 py-2 text-xs leading-relaxed ${s.severity === 'warning' ? 'bg-accent-soft' : 'bg-paper'}`}>
                    {s.message}
                    {s.suggestedKind && (
                      <button
                        type="button"
                        className="mt-1 block text-ink underline underline-offset-2"
                        onClick={() => addNode(s.suggestedKind!)}
                      >
                        {NODE_KIND_META[s.suggestedKind].label}ノードを追加
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function NodeInspector({
  node,
  onChange,
  onDelete,
}: {
  node: KnowledgeFlowNode
  onChange: (patch: Partial<KnowledgeFlowNode['data']>) => void
  onDelete: () => void
}) {
  const meta = NODE_KIND_META[node.data.kind]
  return (
    <div className="space-y-3" data-testid="node-inspector">
      <p className="text-sm font-medium" style={{ color: meta.color }}>
        {meta.label}ノードを編集
      </p>
      <label className="block text-xs text-muted">
        種別
        <select
          value={node.data.kind}
          onChange={(e) => {
            const kind = e.target.value as NodeKind
            onChange({ kind, verdict: kind === 'hypothesis' ? (node.data.verdict ?? 'open') : undefined })
          }}
          className="mt-1 block h-9 w-full rounded-md border border-line-strong bg-white px-2 text-sm text-charcoal"
        >
          {NODE_KINDS.map((k) => (
            <option key={k} value={k}>
              {NODE_KIND_META[k].label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        ラベル
        <input
          value={node.data.label}
          onChange={(e) => onChange({ label: e.target.value })}
          maxLength={80}
          className="mt-1 block h-9 w-full rounded-md border border-line-strong bg-white px-2 text-sm text-charcoal"
          aria-label="ノードのラベル"
        />
      </label>
      <label className="block text-xs text-muted">
        詳細メモ
        <textarea
          value={node.data.detail ?? ''}
          onChange={(e) => onChange({ detail: e.target.value })}
          rows={4}
          className="mt-1 block w-full rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-charcoal"
        />
      </label>
      {node.data.kind === 'hypothesis' && (
        <label className="block text-xs text-muted">
          判定
          <select
            value={node.data.verdict ?? 'open'}
            onChange={(e) => onChange({ verdict: e.target.value as HypothesisVerdict })}
            className="mt-1 block h-9 w-full rounded-md border border-line-strong bg-white px-2 text-sm text-charcoal"
          >
            {Object.entries(VERDICT_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button size="sm" variant="danger" onClick={onDelete} icon={<Trash2 className="size-3.5" aria-hidden />}>
        ノードを削除
      </Button>
    </div>
  )
}
