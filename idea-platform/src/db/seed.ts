import {
  DEMO_CONNECTIONS,
  DEMO_CREATORS,
  DEMO_EDGES,
  DEMO_IDEAS,
  DEMO_NODES,
  DEMO_PROJECT,
  DEMO_PURCHASES,
  DEMO_REVIEWS,
  DEMO_SOURCES,
  DEMO_USERS,
  SEED_VERSION,
} from '../data/seed'
import { BACKUP_TABLES, db, type AppDatabase } from './database'

const SEED_KEY = 'seedVersion'

/** 初回のみデモデータを投入する */
export async function ensureSeeded(database: AppDatabase = db): Promise<void> {
  const current = await database.settings.get(SEED_KEY)
  if (current && Number(current.value) >= SEED_VERSION) return
  await seedDemoData(database)
}

/** デモデータを初期状態に戻す（ローカルの全データを置き換え） */
export async function seedDemoData(database: AppDatabase = db): Promise<void> {
  await database.transaction('rw', [...BACKUP_TABLES.map((t) => database.table(t)), database.settings], async () => {
    await Promise.all(BACKUP_TABLES.map((t) => database.table(t).clear()))
    await database.users.bulkPut(DEMO_USERS)
    await database.creators.bulkPut(DEMO_CREATORS)
    await database.ideas.bulkPut(DEMO_IDEAS)
    await database.reviews.bulkPut(DEMO_REVIEWS)
    await database.purchases.bulkPut(DEMO_PURCHASES)
    await database.connections.bulkPut(DEMO_CONNECTIONS)
    await database.projects.put(DEMO_PROJECT)
    await database.nodes.bulkPut(DEMO_NODES)
    await database.edges.bulkPut(DEMO_EDGES)
    await database.sources.bulkPut(DEMO_SOURCES)
    await database.settings.put({ key: SEED_KEY, value: String(SEED_VERSION) })
  })
}
