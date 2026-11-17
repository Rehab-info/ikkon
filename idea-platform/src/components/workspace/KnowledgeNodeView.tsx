import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NODE_KIND_META, VERDICT_META } from '../../lib/labels'
import type { KnowledgeFlowNode } from './flow'

const handleClass = '!size-2.5 !border-white !bg-line-strong'

/** 知識マップのノード。色・アイコン・文字ラベルの3つで種別を示す */
export function KnowledgeNodeView({ data, selected }: NodeProps<KnowledgeFlowNode>) {
  const meta = NODE_KIND_META[data.kind]
  const Icon = meta.icon
  return (
    <div
      className={`w-[200px] rounded-md border bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(20,33,61,0.06)] ${
        selected ? 'ring-2 ring-ink ring-offset-1' : ''
      }`}
      style={{ borderColor: meta.color, borderLeftWidth: 4, background: meta.tint }}
      data-testid="knowledge-node"
      data-kind={data.kind}
    >
      <Handle type="target" position={Position.Top} className={handleClass} />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
      <Handle type="target" position={Position.Left} id="l" className={handleClass} />
      <Handle type="source" position={Position.Right} id="r" className={handleClass} />
      <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: meta.color }}>
        <Icon className="size-3.5" aria-hidden />
        <span>{meta.label}</span>
        {data.kind === 'hypothesis' && data.verdict && (
          <span className="ml-auto rounded bg-white/80 px-1.5 text-[10px] text-charcoal">{VERDICT_META[data.verdict].label}</span>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink break-words">{data.label || '（無題）'}</p>
    </div>
  )
}
