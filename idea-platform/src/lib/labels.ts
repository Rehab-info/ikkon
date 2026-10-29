import {
  BookOpen,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Lightbulb,
  ListChecks,
  Puzzle,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import type {
  ConnectionStatus,
  ConsultationStatus,
  EdgeRelation,
  HypothesisVerdict,
  IdeaStatus,
  NodeKind,
  ReviewStatus,
  Role,
  SourceKind,
  ValidationStage,
} from '../types'

export const ROLE_LABEL: Record<Role, string> = {
  buyer: '購入者',
  creator: '創作者',
  admin: '運営（デモ）',
}

export const IDEA_STATUS_META: Record<IdeaStatus, { label: string; tone: BadgeTone; description: string }> = {
  published: { label: '購入受付中', tone: 'ink', description: '購入デモと相談申請ができます。' },
  nondisclosure: {
    label: '非公開期間中',
    tone: 'brass',
    description: '初回購入者のための非公開期間中のため、新規の購入受付を停止しています。',
  },
  review: { label: '審査中', tone: 'slate', description: '運営による出品審査中です。' },
  draft: { label: '下書き', tone: 'slate', description: '公開されていません。' },
  paused: { label: '公開停止', tone: 'rust', description: '運営により公開を停止しています。' },
  rejected: { label: '非承認', tone: 'rust', description: '審査の結果、公開されていません。' },
}

export type BadgeTone = 'ink' | 'brass' | 'slate' | 'rust' | 'moss' | 'outline'

export const VALIDATION_STAGE_META: Record<ValidationStage, { label: string; step: number }> = {
  concept: { label: '構想段階', step: 1 },
  researched: { label: '机上調査済み', step: 2 },
  interviewed: { label: 'ヒアリング実施済み', step: 3 },
  prototyped: { label: '簡易試作・検証済み', step: 4 },
}

export const CONSULTATION_META: Record<ConsultationStatus, { label: string; tone: BadgeTone }> = {
  open: { label: '相談受付中', tone: 'moss' },
  limited: { label: '条件付きで受付', tone: 'brass' },
  closed: { label: '現在受付停止', tone: 'slate' },
}

export const CONNECTION_STATUS_META: Record<ConnectionStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: '創作者の返答待ち', tone: 'slate' },
  accepted: { label: '双方同意済み', tone: 'moss' },
  declined: { label: '今回は見送り', tone: 'rust' },
  withdrawn: { label: '申請取り下げ', tone: 'outline' },
}

export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: '審査待ち', tone: 'brass' },
  approved: { label: '承認', tone: 'moss' },
  changes_requested: { label: '差し戻し', tone: 'slate' },
  rejected: { label: '却下', tone: 'rust' },
}

export interface NodeKindMeta {
  label: string
  icon: LucideIcon
  /** 枠線・アイコンの色 */
  color: string
  /** 背景の淡色 */
  tint: string
  hint: string
}

export const NODE_KIND_META: Record<NodeKind, NodeKindMeta> = {
  idea: { label: 'アイデア', icon: Lightbulb, color: '#14213d', tint: '#eef1f7', hint: '中心となる着想' },
  problem: { label: '課題', icon: CircleAlert, color: '#8c2f39', tint: '#f8eef0', hint: '誰の、どんな困りごとか' },
  fact: { label: '事実', icon: BookOpen, color: '#4a5563', tint: '#f1f3f5', hint: '確認できた事実・データ' },
  hypothesis: { label: '仮説', icon: CircleHelp, color: '#94650f', tint: '#fbf5e8', hint: '検証が必要な見立て' },
  evidence: { label: '根拠', icon: CircleCheck, color: '#2f6b4f', tint: '#edf6f1', hint: '仮説を支える材料' },
  counter: { label: '反証', icon: ShieldAlert, color: '#9a4a24', tint: '#f9efe9', hint: '仮説を揺るがす材料' },
  solution: { label: '解決策', icon: Puzzle, color: '#1f6470', tint: '#ebf5f6', hint: '課題への打ち手' },
  plan: { label: '実行計画', icon: ListChecks, color: '#5b4a8a', tint: '#f2effa', hint: '次に何をするか' },
}

export const VERDICT_META: Record<HypothesisVerdict, { label: string; tone: BadgeTone }> = {
  open: { label: '検証中', tone: 'slate' },
  supported: { label: '支持', tone: 'moss' },
  rejected: { label: '棄却', tone: 'rust' },
}

export const EDGE_RELATION_LABEL: Record<EdgeRelation, string> = {
  relates: '関連',
  supports: '支持する',
  refutes: '反証する',
  leads: '展開する',
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  web: 'Webページ',
  book: '書籍',
  paper: '論文・報告書',
  interview: 'ヒアリング',
  data: '統計・データ',
  other: 'その他',
}

export const IIP_SECTION_META = {
  overview: { label: 'アイデア概要', placeholder: 'このアイデアを一言で、そして3〜5文で説明してください。' },
  customerProblem: { label: '顧客課題', placeholder: '誰が、どの場面で、何に困っているか。' },
  proposal: { label: '提案内容', placeholder: '課題をどう解決するか。提供価値と仕組み。' },
  marketResearch: { label: '市場調査', placeholder: '市場規模の見立て、ヒアリング結果、関連する統計など。' },
  competition: { label: '競合分析', placeholder: '既存の手段・代替品との違い。' },
  evidence: { label: '根拠資料', placeholder: '参照した資料・出典・データ。' },
  financialHypothesis: { label: '財務仮説', placeholder: '収益モデル、単価、費用の仮説（数値は仮説であることを明記）。' },
  risks: { label: 'リスク', placeholder: '法規制・技術・市場・運用上のリスク。' },
  validationPlan: { label: '検証計画', placeholder: '次に何を、どの順で、どう検証するか。' },
} as const
