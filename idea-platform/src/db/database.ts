import Dexie, { type EntityTable } from 'dexie'
import { BRAND } from '../config/brand'
import type {
  ActivityLog,
  AppSetting,
  ConnectionRequest,
  CreatorProfile,
  Idea,
  IdeaPackage,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeProject,
  PurchaseDemo,
  ReviewRecord,
  SavedIdea,
  SourceReference,
  User,
} from '../types'

/**
 * ブラウザ内の IndexedDB にのみ保存します。外部送信は行いません。
 */
export class AppDatabase extends Dexie {
  users!: EntityTable<User, 'id'>
  creators!: EntityTable<CreatorProfile, 'id'>
  ideas!: EntityTable<Idea, 'id'>
  packages!: EntityTable<IdeaPackage, 'id'>
  projects!: EntityTable<KnowledgeProject, 'id'>
  nodes!: EntityTable<KnowledgeNode, 'id'>
  edges!: EntityTable<KnowledgeEdge, 'id'>
  sources!: EntityTable<SourceReference, 'id'>
  purchases!: EntityTable<PurchaseDemo, 'id'>
  connections!: EntityTable<ConnectionRequest, 'id'>
  reviews!: EntityTable<ReviewRecord, 'id'>
  activity!: EntityTable<ActivityLog, 'id'>
  saved!: EntityTable<SavedIdea, 'id'>
  settings!: EntityTable<AppSetting, 'key'>

  constructor(name: string = BRAND.databaseName) {
    super(name)
    this.version(1).stores({
      users: 'id, role',
      creators: 'id',
      ideas: 'id, creatorId, status, category',
      packages: 'id, ownerId, projectId',
      projects: 'id, ownerId, updatedAt',
      nodes: 'id, projectId',
      edges: 'id, projectId',
      sources: 'id, projectId',
      purchases: 'id, buyerId, ideaId, createdAt',
      connections: 'id, creatorId, requesterId, status, createdAt',
      reviews: 'id, ideaId, status, createdAt',
      activity: 'id, createdAt',
      saved: 'id, userId, ideaId',
      settings: 'key',
    })
  }
}

export const db = new AppDatabase()

/** バックアップ対象のテーブル名 */
export const BACKUP_TABLES = [
  'users',
  'creators',
  'ideas',
  'packages',
  'projects',
  'nodes',
  'edges',
  'sources',
  'purchases',
  'connections',
  'reviews',
  'activity',
  'saved',
] as const
export type BackupTableName = (typeof BACKUP_TABLES)[number]
