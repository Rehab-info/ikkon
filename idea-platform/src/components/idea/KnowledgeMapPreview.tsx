import { Background, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import type { SampleMap } from '../../types'
import { edgeAppearance, type KnowledgeFlowEdge, type KnowledgeFlowNode } from '../workspace/flow'
import { nodeTypes } from '../workspace/nodeTypes'

/** 読み取り専用のサンプル知識マップ（購入前に公開できる範囲のみ） */
export default function KnowledgeMapPreview({ map, height = 360 }: { map: SampleMap; height?: number }) {
  const nodes = useMemo<KnowledgeFlowNode[]>(
    () =>
      map.nodes.map((n) => ({
        id: n.id,
        type: 'knowledge',
        position: { x: n.x, y: n.y },
        data: { kind: n.kind, label: n.label },
        draggable: false,
        selectable: false,
        connectable: false,
      })),
    [map],
  )
  const edges = useMemo<KnowledgeFlowEdge[]>(
    () => map.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: { relation: e.relation }, ...edgeAppearance(e.relation) })),
    [map],
  )
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white" style={{ height }} aria-label="サンプル知識マップ（読み取り専用）" role="img">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={24} color="#eceef1" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
