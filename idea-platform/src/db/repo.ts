import { NONDISCLOSURE_MONTHS, STANDARD_PRICE } from '../data/seed'
import { createId, nowIso } from '../lib/id'
import {
  IIP_SECTION_KEYS,
  type ActivityLog,
  type CollaborationForm,
  type ConnectionPurpose,
  type Idea,
  type IdeaPackage,
  type IdeaStatus,
  type KnowledgeEdge,
  type KnowledgeNode,
  type KnowledgeProject,
  type PurchaseDemo,
  type ReviewChecklistKey,
  type ReviewRecord,
  type ReviewStatus,
  type SampleMap,
  type SourceReference,
  type User,
  REVIEW_CHECKLIST,
} from '../types'
import { db } from './database'

/* ---------- 操作履歴（デモ用。本番の監査ログではありません） ---------- */

export async function logActivity(
  actorId: string,
  action: ActivityLog['action'],
  targetId: string,
  summary: string,
): Promise<void> {
  await db.activity.add({ id: createId('act'), actorId, action, targetId, summary, createdAt: nowIso() })
}

/* ---------- 保存したアイデア ---------- */

export async function toggleSavedIdea(userId: string, ideaId: string): Promise<boolean> {
  const id = `${userId}:${ideaId}`
  const existing = await db.saved.get(id)
  if (existing) {
    await db.saved.delete(id)
    return false
  }
  await db.saved.put({ id, userId, ideaId, createdAt: nowIso() })
  return true
}

/* ---------- 購入デモ ---------- */

export class DemoError extends Error {}

export async function createPurchaseDemo(idea: Idea, buyerId: string, acceptedTerms: string[]): Promise<PurchaseDemo> {
  if (idea.status !== 'published') {
    throw new DemoError('このアイデアは現在、購入を受け付けていません。')
  }
  const record: PurchaseDemo = {
    id: createId('pd'),
    ideaId: idea.id,
    ideaTitle: idea.title,
    buyerId,
    price: idea.price,
    acceptedTerms,
    nondisclosureMonths: NONDISCLOSURE_MONTHS,
    kind: 'demo',
    createdAt: nowIso(),
  }
  await db.purchases.add(record)
  await logActivity(buyerId, 'purchase_demo', idea.id, `購入デモ：「${idea.title}」（決済なし）`)
  return record
}

/* ---------- 相談申請 ---------- */

export interface ConnectionInput {
  creatorId: string
  requesterId: string
  ideaId?: string
  purpose: ConnectionPurpose
  message: string
  collaboration: CollaborationForm
}

export async function createConnectionRequest(input: ConnectionInput): Promise<string> {
  const creator = await db.creators.get(input.creatorId)
  if (!creator) throw new DemoError('創作者が見つかりません。')
  if (creator.consultation === 'closed') throw new DemoError('この創作者は現在、相談の受付を停止しています。')
  const id = createId('cr')
  const now = nowIso()
  await db.connections.add({
    id,
    ...input,
    status: 'pending',
    requesterConsent: true,
    creatorConsent: null,
    createdAt: now,
    updatedAt: now,
  })
  await logActivity(input.requesterId, 'connection_request', id, `${creator.displayName}さんへ相談申請（デモ）`)
  return id
}

export async function replyConnection(id: string, actorId: string, accept: boolean, reply: string): Promise<void> {
  await db.connections.update(id, {
    status: accept ? 'accepted' : 'declined',
    creatorConsent: accept,
    creatorReply: reply.trim() || undefined,
    updatedAt: nowIso(),
  })
  await logActivity(actorId, 'connection_reply', id, accept ? '相談申請を承諾（双方同意）' : '相談申請を見送り')
}

export async function withdrawConnection(id: string, actorId: string): Promise<void> {
  await db.connections.update(id, { status: 'withdrawn', requesterConsent: false, updatedAt: nowIso() })
  await logActivity(actorId, 'connection_reply', id, '相談申請を取り下げ')
}

/* ---------- 知識創造プロジェクト ---------- */

export async function createProject(ownerId: string, title: string, description: string): Promise<string> {
  const now = nowIso()
  const project: KnowledgeProject = {
    id: createId('kp'),
    ownerId,
    title: title.trim(),
    description: description.trim(),
    memos: [],
    structure: { problem: '', customer: '', solution: '', differentiation: '', evidence: '' },
    createdAt: now,
    updatedAt: now,
  }
  const centerNode: KnowledgeNode = {
    id: createId('kn'),
    projectId: project.id,
    kind: 'idea',
    label: project.title,
    detail: '',
    position: { x: 240, y: 40 },
    updatedAt: now,
  }
  await db.transaction('rw', db.projects, db.nodes, async () => {
    await db.projects.add(project)
    await db.nodes.add(centerNode)
  })
  await logActivity(ownerId, 'project_create', project.id, `プロジェクト作成：「${project.title}」`)
  return project.id
}

export async function updateProject(id: string, patch: Partial<Omit<KnowledgeProject, 'id'>>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.nodes, db.edges, db.sources, db.packages], async () => {
    await db.nodes.where('projectId').equals(id).delete()
    await db.edges.where('projectId').equals(id).delete()
    await db.sources.where('projectId').equals(id).delete()
    // IIP は残し、プロジェクトとの連携だけ外す
    await db.packages.where('projectId').equals(id).modify({ projectId: undefined })
    await db.projects.delete(id)
  })
}

/** 知識マップのノードとエッジを丸ごと保存する */
export async function saveGraph(projectId: string, nodes: KnowledgeNode[], edges: KnowledgeEdge[]): Promise<void> {
  await db.transaction('rw', db.nodes, db.edges, db.projects, async () => {
    await db.nodes.where('projectId').equals(projectId).delete()
    await db.edges.where('projectId').equals(projectId).delete()
    await db.nodes.bulkPut(nodes)
    await db.edges.bulkPut(edges)
    await db.projects.update(projectId, { updatedAt: nowIso() })
  })
}

export async function addSource(input: Omit<SourceReference, 'id' | 'createdAt'>): Promise<void> {
  await db.sources.add({ ...input, id: createId('src'), createdAt: nowIso() })
}

export async function deleteSource(id: string): Promise<void> {
  await db.sources.delete(id)
}

/* ---------- IIP ---------- */

function emptySections(): IdeaPackage['sections'] {
  return Object.fromEntries(IIP_SECTION_KEYS.map((k) => [k, ''])) as IdeaPackage['sections']
}

/** プロジェクトの構造化結果と知識マップから IIP の下書きを作る */
export async function createPackageFromProject(projectId: string, ownerId: string): Promise<string> {
  const project = await db.projects.get(projectId)
  if (!project) throw new DemoError('プロジェクトが見つかりません。')
  const nodes = await db.nodes.where('projectId').equals(projectId).toArray()
  const sources = await db.sources.where('projectId').equals(projectId).toArray()
  const labels = (kind: KnowledgeNode['kind']) =>
    nodes
      .filter((n) => n.kind === kind)
      .map((n) => `・${n.label}`)
      .join('\n')

  const sections = emptySections()
  sections.overview = project.description
  sections.customerProblem = project.structure.problem || labels('problem')
  sections.proposal = project.structure.solution || labels('solution')
  sections.competition = project.structure.differentiation
  sections.evidence = [
    project.structure.evidence,
    labels('evidence'),
    sources.map((s) => `・${s.title}`).join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
  sections.risks = labels('counter')
  sections.validationPlan = labels('plan')
  sections.marketResearch = labels('fact')

  const now = nowIso()
  const pkg: IdeaPackage = {
    id: createId('iip'),
    projectId,
    ownerId,
    title: project.title,
    category: 'ビジネス',
    catchcopy: '',
    targetCustomers: project.structure.customer,
    sections,
    linkedNodeIds: nodes.filter((n) => n.kind === 'idea' || n.kind === 'problem').map((n) => n.id),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  await db.packages.add(pkg)
  return pkg.id
}

export async function createBlankPackage(ownerId: string): Promise<string> {
  const now = nowIso()
  const pkg: IdeaPackage = {
    id: createId('iip'),
    ownerId,
    title: '',
    category: 'ビジネス',
    catchcopy: '',
    targetCustomers: '',
    sections: emptySections(),
    linkedNodeIds: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  await db.packages.add(pkg)
  return pkg.id
}

export async function updatePackage(id: string, patch: Partial<Omit<IdeaPackage, 'id'>>): Promise<void> {
  await db.packages.update(id, { ...patch, updatedAt: nowIso() })
}

/** 出品審査に必要な最低限の入力チェック。エラー文の配列を返す */
export function validatePackageForSubmission(pkg: IdeaPackage): string[] {
  const errors: string[] = []
  if (pkg.title.trim().length < 4) errors.push('タイトルを4文字以上で入力してください。')
  if (pkg.catchcopy.trim().length < 10) errors.push('一文紹介を10文字以上で入力してください。')
  if (!pkg.targetCustomers.trim()) errors.push('想定顧客を入力してください。')
  const required: Array<keyof IdeaPackage['sections']> = ['overview', 'customerProblem', 'proposal', 'risks', 'validationPlan']
  for (const key of required) {
    if (pkg.sections[key].trim().length < 10) errors.push(`「${SECTION_NAME[key]}」を10文字以上で入力してください。`)
  }
  if (/特許権|独占的(な)?権利|独占権/.test(JSON.stringify(pkg))) {
    errors.push('「特許権」「独占的権利」など、誤解を生む権利表示は使用できません。')
  }
  return errors
}

const SECTION_NAME: Record<keyof IdeaPackage['sections'], string> = {
  overview: 'アイデア概要',
  customerProblem: '顧客課題',
  proposal: '提案内容',
  marketResearch: '市場調査',
  competition: '競合分析',
  evidence: '根拠資料',
  financialHypothesis: '財務仮説',
  risks: 'リスク',
  validationPlan: '検証計画',
}

async function buildSampleMap(nodeIds: string[]): Promise<SampleMap> {
  if (nodeIds.length === 0) return { nodes: [], edges: [] }
  const nodes = (await db.nodes.bulkGet(nodeIds)).filter((n): n is KnowledgeNode => Boolean(n))
  const projectIds = new Set(nodes.map((n) => n.projectId))
  const idSet = new Set(nodes.map((n) => n.id))
  const edges = (await db.edges.where('projectId').anyOf([...projectIds]).toArray()).filter(
    (e) => idSet.has(e.source) && idSet.has(e.target),
  )
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, x: n.position.x, y: n.position.y })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, relation: e.relation })),
  }
}

/** IIP を出品審査に申請する（デモ）。審査中のアイデアを作成・更新する */
export async function submitPackageForReview(pkg: IdeaPackage, user: User): Promise<string> {
  const errors = validatePackageForSubmission(pkg)
  if (errors.length > 0) throw new DemoError(errors.join('\n'))
  if (!user.creatorId) throw new DemoError('出品は創作者のデモ利用者でのみ行えます。')

  const now = nowIso()
  const ideaId = pkg.submittedIdeaId ?? createId('idea')
  const existing = await db.ideas.get(ideaId)
  const idea: Idea = {
    id: ideaId,
    creatorId: user.creatorId,
    title: pkg.title.trim(),
    catchcopy: pkg.catchcopy.trim(),
    category: pkg.category,
    tags: [],
    summary: pkg.sections.overview.trim(),
    problem: pkg.sections.customerProblem.trim(),
    targetCustomers: pkg.targetCustomers.trim(),
    differentiation: pkg.sections.competition.trim() || '（記載なし）',
    validation: { stage: 'concept', activities: ['IIPの検証計画に基づき実施予定'] },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '課題・提案・根拠・財務仮説・リスク・検証計画' },
      { name: '知識マップ（完全版）', description: 'ワークスペースで作成した構造図' },
    ],
    sampleMap: await buildSampleMap(pkg.linkedNodeIds),
    price: STANDARD_PRICE,
    status: 'review',
    featuredScore: existing?.featuredScore ?? 50,
    hiddenNotice: '提案内容の詳細、根拠資料、財務仮説、検証計画は購入後の納品物にのみ含まれます。',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    packageId: pkg.id,
    origin: 'user',
  }

  const review: ReviewRecord = {
    id: createId('rv'),
    ideaId,
    packageId: pkg.id,
    submittedBy: user.id,
    status: 'pending',
    checklist: Object.fromEntries(REVIEW_CHECKLIST.map((c) => [c.key, false])) as Record<ReviewChecklistKey, boolean>,
    comment: '',
    createdAt: now,
  }

  await db.transaction('rw', db.ideas, db.reviews, db.packages, async () => {
    await db.ideas.put(idea)
    await db.reviews.add(review)
    await db.packages.update(pkg.id, { status: 'submitted', submittedIdeaId: ideaId, updatedAt: now })
  })
  await logActivity(user.id, 'review_submit', ideaId, `出品審査を申請：「${idea.title}」（デモ）`)
  return review.id
}

/* ---------- 運営（デモ） ---------- */

const STATUS_AFTER_REVIEW: Record<Exclude<ReviewStatus, 'pending'>, IdeaStatus> = {
  approved: 'published',
  changes_requested: 'draft',
  rejected: 'rejected',
}

export async function decideReview(
  reviewId: string,
  decision: Exclude<ReviewStatus, 'pending'>,
  checklist: Record<ReviewChecklistKey, boolean>,
  comment: string,
  adminId: string,
): Promise<void> {
  const review = await db.reviews.get(reviewId)
  if (!review) throw new DemoError('審査記録が見つかりません。')
  if (decision === 'approved' && !Object.values(checklist).every(Boolean)) {
    throw new DemoError('承認するには、品質チェックリストのすべての項目を確認してください。')
  }
  if (decision !== 'approved' && !comment.trim()) {
    throw new DemoError('差し戻し・却下の場合は、理由をコメントに記入してください。')
  }
  const now = nowIso()
  await db.transaction('rw', db.reviews, db.ideas, db.packages, async () => {
    await db.reviews.update(reviewId, { status: decision, checklist, comment: comment.trim(), decidedAt: now })
    await db.ideas.update(review.ideaId, {
      status: STATUS_AFTER_REVIEW[decision],
      updatedAt: now,
      ...(decision === 'approved' ? { publishedAt: now } : {}),
    })
    // 差し戻し時は IIP を再編集・再申請できるようにする
    if (decision === 'changes_requested' && review.packageId) {
      await db.packages.update(review.packageId, { status: 'draft' })
    }
  })
  await logActivity(adminId, 'review_decision', review.ideaId, `審査結果：${decision}`)
}

export async function setIdeaStatus(ideaId: string, status: IdeaStatus, adminId: string): Promise<void> {
  await db.ideas.update(ideaId, { status, updatedAt: nowIso() })
  await logActivity(adminId, 'idea_status', ideaId, `公開状態を変更：${status}`)
}
