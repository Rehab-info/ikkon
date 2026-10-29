/* =========================================================
 * データモデル定義
 * すべて架空のデモデータで使用します。実在の個人情報は保存しません。
 * ========================================================= */

export type ISODate = string

/* ---------- 利用者 ---------- */

/** デモ用ロール。本番の認証・認可ではありません。 */
export type Role = 'buyer' | 'creator' | 'admin'

export interface User {
  id: string
  displayName: string
  role: Role
  /** 所属（任意・架空） */
  organization?: string
  /** 創作者として活動する場合のプロフィールID */
  creatorId?: string
  /** デモ切り替え時の説明 */
  description: string
}

/* ---------- 創作者 ---------- */

export type ConsultationStatus = 'open' | 'limited' | 'closed'

export interface CreatorProfile {
  id: string
  displayName: string
  /** 一言で表す、その人の発想の特徴 */
  tagline: string
  /** アバター背景色（画像は使わない） */
  avatarTone: 'navy' | 'slate' | 'brass' | 'teal' | 'plum' | 'moss'
  /** 創作の背景 */
  background: string
  interests: string[]
  /** 公開可能な経歴（任意。資格・職歴は必須にしない） */
  publicCareer?: string
  /** 思考スタイル */
  thinkingStyle: string[]
  /** アイデア制作の考え方 */
  philosophy: string
  consultation: ConsultationStatus
  /** 相談受付についての補足 */
  consultationNote?: string
  joinedAt: ISODate
}

/* ---------- アイデア ---------- */

export const IDEA_CATEGORIES = [
  'ヘルスケア',
  '教育',
  '環境',
  '地域',
  'IT',
  '生活',
  'ビジネス',
  '文化',
] as const
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number]

export type IdeaStatus = 'draft' | 'review' | 'published' | 'nondisclosure' | 'paused' | 'rejected'

export type ValidationStage = 'concept' | 'researched' | 'interviewed' | 'prototyped'

export interface ValidationStatus {
  stage: ValidationStage
  /** 実施済みの調査・検証（公開できる範囲の要約） */
  activities: string[]
}

/** 公開プレビュー用の知識マップ（核心情報は含めない） */
export interface SampleMap {
  nodes: Array<{ id: string; kind: NodeKind; label: string; x: number; y: number }>
  edges: Array<{ id: string; source: string; target: string; relation: EdgeRelation }>
}

export interface Idea {
  id: string
  creatorId: string
  title: string
  /** カード用の一文 */
  catchcopy: string
  category: IdeaCategory
  tags: string[]
  summary: string
  problem: string
  targetCustomers: string
  differentiation: string
  validation: ValidationStatus
  /** 納品物の一覧（名称と説明。中身は購入前に表示しない） */
  deliverables: Array<{ name: string; description: string }>
  sampleMap: SampleMap
  /** 税込価格（円） */
  price: number
  status: IdeaStatus
  /** 注目度（デモ用の並び替え指標） */
  featuredScore: number
  /** 購入前に開示しない核心部分の説明（中身ではなく「何が非公開か」） */
  hiddenNotice: string
  createdAt: ISODate
  updatedAt: ISODate
  publishedAt?: ISODate
  /** 出品元 IIP（ワークスペースから出品された場合） */
  packageId?: string
  origin: 'seed' | 'user'
}

/** 購入前に表示できる範囲だけを持つ型。一覧・詳細はこの型で描画します。 */
export type IdeaPreview = Pick<
  Idea,
  | 'id'
  | 'creatorId'
  | 'title'
  | 'catchcopy'
  | 'category'
  | 'tags'
  | 'summary'
  | 'problem'
  | 'targetCustomers'
  | 'differentiation'
  | 'validation'
  | 'deliverables'
  | 'sampleMap'
  | 'price'
  | 'status'
  | 'featuredScore'
  | 'hiddenNotice'
  | 'publishedAt'
  | 'updatedAt'
>

/* ---------- IIP（アイデア情報パッケージ） ---------- */

export const IIP_SECTION_KEYS = [
  'overview',
  'customerProblem',
  'proposal',
  'marketResearch',
  'competition',
  'evidence',
  'financialHypothesis',
  'risks',
  'validationPlan',
] as const
export type IipSectionKey = (typeof IIP_SECTION_KEYS)[number]

export interface IdeaPackage {
  id: string
  projectId?: string
  ownerId: string
  title: string
  category: IdeaCategory
  catchcopy: string
  targetCustomers: string
  sections: Record<IipSectionKey, string>
  /** 購入前プレビュー用のサンプル知識マップに使うノードID（核心情報を含めない） */
  linkedNodeIds: string[]
  status: 'draft' | 'submitted'
  submittedIdeaId?: string
  createdAt: ISODate
  updatedAt: ISODate
}

/* ---------- 知識創造ワークスペース ---------- */

export const NODE_KINDS = [
  'idea',
  'problem',
  'fact',
  'hypothesis',
  'evidence',
  'counter',
  'solution',
  'plan',
] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export type HypothesisVerdict = 'open' | 'supported' | 'rejected'

export type EdgeRelation = 'relates' | 'supports' | 'refutes' | 'leads'

export interface ProjectMemo {
  id: string
  body: string
  createdAt: ISODate
  updatedAt: ISODate
}

export interface ProjectStructure {
  problem: string
  customer: string
  solution: string
  differentiation: string
  evidence: string
}

export interface KnowledgeProject {
  id: string
  ownerId: string
  title: string
  description: string
  memos: ProjectMemo[]
  structure: ProjectStructure
  createdAt: ISODate
  updatedAt: ISODate
}

export interface KnowledgeNode {
  id: string
  projectId: string
  kind: NodeKind
  label: string
  detail: string
  position: { x: number; y: number }
  /** 仮説ノードの判定 */
  verdict?: HypothesisVerdict
  updatedAt: ISODate
}

export interface KnowledgeEdge {
  id: string
  projectId: string
  source: string
  target: string
  relation: EdgeRelation
}

export type SourceKind = 'web' | 'book' | 'paper' | 'interview' | 'data' | 'other'

export interface SourceReference {
  id: string
  projectId: string
  title: string
  kind: SourceKind
  /** 参照URL（任意。アプリから自動で外部アクセスはしない） */
  url?: string
  note: string
  createdAt: ISODate
}

/* ---------- 取引・相談・審査（すべてデモ） ---------- */

export interface PurchaseDemo {
  id: string
  ideaId: string
  ideaTitle: string
  buyerId: string
  price: number
  /** 確認した利用条件のキー */
  acceptedTerms: string[]
  nondisclosureMonths: number
  /** 常に demo。決済・契約・権利移転は行われない */
  kind: 'demo'
  createdAt: ISODate
}

export const CONNECTION_PURPOSES = [
  'アイデアについて話したい',
  '追加の説明を聞きたい',
  '共同開発を相談したい',
  '事業化について協力したい',
] as const
export type ConnectionPurpose = (typeof CONNECTION_PURPOSES)[number]

export const COLLABORATION_FORMS = [
  'オンラインでの対話（30分程度）',
  '追加資料での説明',
  '共同での検証・試作',
  '事業化に向けた継続的な協力',
  'まずは話してから決めたい',
] as const
export type CollaborationForm = (typeof COLLABORATION_FORMS)[number]

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export interface ConnectionRequest {
  id: string
  creatorId: string
  requesterId: string
  ideaId?: string
  purpose: ConnectionPurpose
  message: string
  collaboration: CollaborationForm
  status: ConnectionStatus
  /** 申請者の同意（申請時に true） */
  requesterConsent: boolean
  /** 創作者の同意（未回答は null） */
  creatorConsent: boolean | null
  creatorReply?: string
  createdAt: ISODate
  updatedAt: ISODate
}

export const REVIEW_CHECKLIST = [
  { key: 'noPersonalInfo', label: '個人情報・第三者の秘密情報が含まれていない' },
  { key: 'noMisleadingRights', label: '特許権・独占権など誤解を生む権利表示がない' },
  { key: 'problemClear', label: '解決する課題と想定顧客が具体的に書かれている' },
  { key: 'evidenceListed', label: '根拠資料・調査の出典が示されている' },
  { key: 'risksStated', label: 'リスクと検証計画が記載されている' },
  { key: 'previewSafe', label: '購入前プレビューに核心情報が含まれていない' },
] as const
export type ReviewChecklistKey = (typeof REVIEW_CHECKLIST)[number]['key']

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected'

export interface ReviewRecord {
  id: string
  ideaId: string
  packageId?: string
  submittedBy: string
  status: ReviewStatus
  checklist: Record<ReviewChecklistKey, boolean>
  comment: string
  createdAt: ISODate
  decidedAt?: ISODate
}

export interface ActivityLog {
  id: string
  actorId: string
  action:
    | 'purchase_demo'
    | 'connection_request'
    | 'connection_reply'
    | 'review_submit'
    | 'review_decision'
    | 'idea_status'
    | 'project_create'
    | 'backup_import'
    | 'demo_reset'
  targetId: string
  summary: string
  createdAt: ISODate
}

export interface SavedIdea {
  id: string
  userId: string
  ideaId: string
  createdAt: ISODate
}

export interface AppSetting {
  key: string
  value: string
}
