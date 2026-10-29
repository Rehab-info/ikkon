import { BRAND } from '../config/brand'
import { createId, nowIso } from '../lib/id'
import {
  NODE_KINDS,
  type EdgeRelation,
  type KnowledgeEdge,
  type KnowledgeNode,
  type KnowledgeProject,
  type SourceReference,
} from '../types'
import { BACKUP_TABLES, db, type AppDatabase, type BackupTableName } from './database'

export const BACKUP_SCHEMA_VERSION = 1
/** 取り込めるファイルの上限（バイト） */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

export interface FullBackup {
  format: string
  kind: 'full'
  schemaVersion: number
  exportedAt: string
  tables: Record<BackupTableName, unknown[]>
}

export interface ProjectBackup {
  format: string
  kind: 'project'
  schemaVersion: number
  exportedAt: string
  project: KnowledgeProject
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  sources: SourceReference[]
}

export class BackupError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringId(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0
}

/** JSON 文字列を解析する。サイズと構文を検証 */
export function parseJsonText(text: string): unknown {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) {
    throw new BackupError('ファイルが大きすぎます（上限10MB）。')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new BackupError('JSONとして読み込めませんでした。ファイルの内容を確認してください。')
  }
}

function assertHeader(data: unknown, kind: 'full' | 'project'): asserts data is Record<string, unknown> {
  if (!isRecord(data)) throw new BackupError('バックアップの形式が正しくありません。')
  if (data.format !== BRAND.backupAppId) {
    throw new BackupError('このアプリのバックアップファイルではありません。')
  }
  if (data.kind !== kind) {
    throw new BackupError(
      kind === 'full'
        ? 'プロジェクト単位のファイルです。ワークスペースの「インポート」から読み込んでください。'
        : '全体バックアップのファイルです。マイページの「バックアップから復元」から読み込んでください。',
    )
  }
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('対応していないバージョンのファイルです。')
  }
}

/* ---------- 全体バックアップ ---------- */

export async function exportAll(database: AppDatabase = db): Promise<FullBackup> {
  const entries = await Promise.all(BACKUP_TABLES.map(async (t) => [t, await database.table(t).toArray()] as const))
  return {
    format: BRAND.backupAppId,
    kind: 'full',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: nowIso(),
    tables: Object.fromEntries(entries) as FullBackup['tables'],
  }
}

export function validateFullBackup(data: unknown): FullBackup {
  assertHeader(data, 'full')
  if (!isRecord(data.tables)) throw new BackupError('バックアップにデータが含まれていません。')
  const tables = data.tables
  for (const name of BACKUP_TABLES) {
    const rows = tables[name]
    if (!Array.isArray(rows)) throw new BackupError(`「${name}」のデータがありません。`)
    if (!rows.every(hasStringId)) throw new BackupError(`「${name}」に不正な行があります。`)
  }
  if ((tables.users as unknown[]).length === 0) throw new BackupError('利用者データが空です。')
  return data as unknown as FullBackup
}

/** 全体バックアップから復元（現在のデータは置き換え） */
export async function importAll(data: unknown, database: AppDatabase = db): Promise<void> {
  const backup = validateFullBackup(data)
  await database.transaction('rw', BACKUP_TABLES.map((t) => database.table(t)), async () => {
    for (const name of BACKUP_TABLES) {
      const table = database.table(name)
      await table.clear()
      await table.bulkPut(backup.tables[name])
    }
  })
}

/* ---------- プロジェクト単位 ---------- */

export async function exportProject(projectId: string, database: AppDatabase = db): Promise<ProjectBackup> {
  const project = await database.projects.get(projectId)
  if (!project) throw new BackupError('プロジェクトが見つかりません。')
  const [nodes, edges, sources] = await Promise.all([
    database.nodes.where('projectId').equals(projectId).toArray(),
    database.edges.where('projectId').equals(projectId).toArray(),
    database.sources.where('projectId').equals(projectId).toArray(),
  ])
  return {
    format: BRAND.backupAppId,
    kind: 'project',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: nowIso(),
    project,
    nodes,
    edges,
    sources,
  }
}

const RELATIONS: EdgeRelation[] = ['relates', 'supports', 'refutes', 'leads']

export function validateProjectBackup(data: unknown): ProjectBackup {
  assertHeader(data, 'project')
  const { project, nodes, edges, sources } = data
  if (!isRecord(project) || typeof project.title !== 'string') throw new BackupError('プロジェクト情報が不正です。')
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(sources)) {
    throw new BackupError('知識マップのデータが不正です。')
  }
  for (const n of nodes) {
    if (
      !hasStringId(n) ||
      !NODE_KINDS.includes((n as KnowledgeNode).kind) ||
      typeof (n as KnowledgeNode).label !== 'string' ||
      !isRecord((n as KnowledgeNode).position) ||
      typeof (n as KnowledgeNode).position.x !== 'number' ||
      typeof (n as KnowledgeNode).position.y !== 'number'
    ) {
      throw new BackupError('ノードのデータが不正です。')
    }
  }
  const nodeIds = new Set(nodes.map((n) => (n as KnowledgeNode).id))
  for (const e of edges) {
    const edge = e as KnowledgeEdge
    if (!hasStringId(e) || !nodeIds.has(edge.source) || !nodeIds.has(edge.target) || !RELATIONS.includes(edge.relation)) {
      throw new BackupError('接続線のデータが不正です。')
    }
  }
  if (!sources.every(hasStringId)) throw new BackupError('情報ソースのデータが不正です。')
  return data as unknown as ProjectBackup
}

/**
 * プロジェクトを新しいIDで取り込む（既存データを上書きしない）。
 * @returns 新しいプロジェクトID
 */
export async function importProject(data: unknown, ownerId: string, database: AppDatabase = db): Promise<string> {
  const backup = validateProjectBackup(data)
  const now = nowIso()
  const projectId = createId('kp')
  const idMap = new Map<string, string>()
  for (const n of backup.nodes) idMap.set(n.id, createId('kn'))

  const project: KnowledgeProject = {
    id: projectId,
    ownerId,
    title: `${backup.project.title}（インポート）`,
    description: String(backup.project.description ?? ''),
    memos: Array.isArray(backup.project.memos) ? backup.project.memos : [],
    structure: {
      problem: '',
      customer: '',
      solution: '',
      differentiation: '',
      evidence: '',
      ...(isRecord(backup.project.structure) ? backup.project.structure : {}),
    },
    createdAt: now,
    updatedAt: now,
  }
  const nodes: KnowledgeNode[] = backup.nodes.map((n) => ({
    id: idMap.get(n.id)!,
    projectId,
    kind: n.kind,
    label: n.label,
    detail: typeof n.detail === 'string' ? n.detail : '',
    position: { x: n.position.x, y: n.position.y },
    verdict: n.verdict,
    updatedAt: now,
  }))
  const edges: KnowledgeEdge[] = backup.edges.map((e) => ({
    id: createId('ke'),
    projectId,
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
    relation: e.relation,
  }))
  const sources: SourceReference[] = backup.sources.map((s) => ({
    ...s,
    id: createId('src'),
    projectId,
  }))

  await database.transaction('rw', database.projects, database.nodes, database.edges, database.sources, async () => {
    await database.projects.add(project)
    await database.nodes.bulkAdd(nodes)
    await database.edges.bulkAdd(edges)
    await database.sources.bulkAdd(sources)
  })
  return projectId
}
