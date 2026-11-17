/* =========================================================
 * 知識創造アシスタントのインターフェース
 *
 * 初期実装では外部AIへの接続は行いません。
 * ローカルのルールベース実装（LocalRuleAssistant）のみが動作します。
 *
 * 将来 AI を接続する場合：
 *  1. KnowledgeAssistant を実装したクラスを作成する
 *  2. API キーはブラウザに埋め込まず、サーバー側（BFF）で保持する
 *  3. 送信先と送信内容を利用者に明示し、同意を得てから送信する
 *  4. getAssistant() の返り値を差し替える
 * ========================================================= */
import type { KnowledgeEdge, KnowledgeNode, KnowledgeProject, NodeKind } from '../types'

export interface AssistantContext {
  project: KnowledgeProject
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export interface AssistantSuggestion {
  id: string
  severity: 'info' | 'warning'
  message: string
  /** 追加を提案するノード種別（任意） */
  suggestedKind?: NodeKind
  /** 対象ノード */
  nodeId?: string
}

export interface KnowledgeAssistant {
  /** 表示名 */
  readonly name: string
  /** 外部送信の有無（UIで明示するため） */
  readonly sendsDataExternally: boolean
  /** 送信先の説明（外部送信する場合は必須） */
  readonly destination?: string
  review(context: AssistantContext): Promise<AssistantSuggestion[]>
}

/** 外部送信を行わない、ルールベースの点検 */
export class LocalRuleAssistant implements KnowledgeAssistant {
  readonly name = 'ローカル点検（ルールベース）'
  readonly sendsDataExternally = false

  async review({ nodes, edges }: AssistantContext): Promise<AssistantSuggestion[]> {
    const out: AssistantSuggestion[] = []
    const count = (kind: NodeKind) => nodes.filter((n) => n.kind === kind).length
    const incoming = (id: string, relation: KnowledgeEdge['relation']) =>
      edges.filter((e) => e.target === id && e.relation === relation).length

    if (nodes.length === 0) {
      out.push({ id: 'empty', severity: 'info', message: 'まず「アイデア」か「課題」のノードを1つ置いてみましょう。', suggestedKind: 'idea' })
      return out
    }
    if (count('problem') === 0) {
      out.push({ id: 'no-problem', severity: 'warning', message: '「課題」ノードがありません。誰の、どんな困りごとを解くのかを書き出しましょう。', suggestedKind: 'problem' })
    }
    for (const h of nodes.filter((n) => n.kind === 'hypothesis')) {
      const support = incoming(h.id, 'supports')
      const refute = incoming(h.id, 'refutes')
      if (support === 0) {
        out.push({ id: `h-ev-${h.id}`, severity: 'warning', nodeId: h.id, message: `仮説「${h.label}」を支える根拠がまだありません。`, suggestedKind: 'evidence' })
      }
      if (refute === 0) {
        out.push({ id: `h-ct-${h.id}`, severity: 'info', nodeId: h.id, message: `仮説「${h.label}」への反証を探してみましょう。反証に耐えた仮説ほど信頼されます。`, suggestedKind: 'counter' })
      }
    }
    if (count('solution') > 0 && count('plan') === 0) {
      out.push({ id: 'no-plan', severity: 'info', message: '解決策に対する「実行計画」（次に何を確かめるか）を追加しましょう。', suggestedKind: 'plan' })
    }
    const connected = new Set(edges.flatMap((e) => [e.source, e.target]))
    const isolated = nodes.filter((n) => !connected.has(n.id))
    if (nodes.length > 1 && isolated.length > 0) {
      out.push({ id: 'isolated', severity: 'info', message: `どこにも接続されていないノードが${isolated.length}件あります。関係を線でつなぎましょう。` })
    }
    if (out.length === 0) {
      out.push({ id: 'ok', severity: 'info', message: '大きな抜けは見つかりませんでした。構造化タブで整理してIIPを作成できます。' })
    }
    return out
  }
}

let current: KnowledgeAssistant = new LocalRuleAssistant()

export function getAssistant(): KnowledgeAssistant {
  return current
}

/** テストや将来の差し替え用 */
export function setAssistant(assistant: KnowledgeAssistant): void {
  current = assistant
}
