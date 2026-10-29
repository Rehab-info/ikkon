import { MarkerType, type Edge, type Node } from '@xyflow/react'
import { EDGE_RELATION_LABEL } from '../../lib/labels'
import type { EdgeRelation, HypothesisVerdict, NodeKind } from '../../types'

export type KnowledgeNodeData = {
  kind: NodeKind
  label: string
  detail?: string
  verdict?: HypothesisVerdict
}
export type KnowledgeFlowNode = Node<KnowledgeNodeData, 'knowledge'>
export type KnowledgeFlowEdge = Edge<{ relation: EdgeRelation }>

const EDGE_STYLE: Record<EdgeRelation, { stroke: string; dash?: string }> = {
  relates: { stroke: '#9aa1ab' },
  supports: { stroke: '#2f6b4f' },
  refutes: { stroke: '#9a3a24', dash: '6 4' },
  leads: { stroke: '#14213d' },
}

export function edgeAppearance(relation: EdgeRelation): Pick<KnowledgeFlowEdge, 'style' | 'label' | 'markerEnd' | 'labelStyle' | 'labelBgStyle'> {
  const s = EDGE_STYLE[relation]
  return {
    label: EDGE_RELATION_LABEL[relation],
    style: { stroke: s.stroke, strokeWidth: 1.5, strokeDasharray: s.dash },
    markerEnd: { type: MarkerType.ArrowClosed, color: s.stroke, width: 16, height: 16 },
    labelStyle: { fontSize: 11, fill: s.stroke },
    labelBgStyle: { fill: '#ffffff' },
  }
}
