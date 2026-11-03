import { beforeEach, describe, expect, it } from 'vitest'
import {
  BackupError,
  exportAll,
  exportProject,
  importAll,
  importProject,
  parseJsonText,
  validateFullBackup,
} from '../../src/db/backup'
import { AppDatabase } from '../../src/db/database'
import { seedDemoData } from '../../src/db/seed'

let db: AppDatabase
let n = 0

beforeEach(async () => {
  db = new AppDatabase(`test-${++n}`)
  await seedDemoData(db)
})

describe('全体バックアップ', () => {
  it('書き出し → 変更 → 復元で元の状態に戻る', async () => {
    const backup = await exportAll(db)
    const json = JSON.stringify(backup)

    await db.ideas.clear()
    await db.projects.clear()
    expect(await db.ideas.count()).toBe(0)

    await importAll(parseJsonText(json), db)
    expect(await db.ideas.count()).toBe(backup.tables.ideas.length)
    expect(await db.projects.get('kp_sample')).toMatchObject({ title: expect.stringContaining('通院') })
  })

  it('別アプリのJSONや壊れたデータは拒否する', () => {
    expect(() => parseJsonText('{not json')).toThrow(BackupError)
    expect(() => validateFullBackup({ format: 'other', kind: 'full', schemaVersion: 1, tables: {} })).toThrow(BackupError)
  })

  it('行にIDがないデータは拒否し、既存データは変更しない', async () => {
    const backup = await exportAll(db)
    const broken = { ...backup, tables: { ...backup.tables, ideas: [{ title: 'no id' }] } }
    const before = await db.ideas.count()
    await expect(importAll(broken, db)).rejects.toThrow(BackupError)
    expect(await db.ideas.count()).toBe(before)
  })

  it('プロジェクト単位のファイルを全体復元に使うと案内付きで拒否する', async () => {
    const project = await exportProject('kp_sample', db)
    expect(() => validateFullBackup(project)).toThrow(/プロジェクト単位/)
  })
})

describe('プロジェクトのエクスポート・インポート', () => {
  it('新しいIDで取り込み、ノードと接続の対応を保つ', async () => {
    const exported = JSON.parse(JSON.stringify(await exportProject('kp_sample', db)))
    const newId = await importProject(exported, 'u_creator', db)

    expect(newId).not.toBe('kp_sample')
    const nodes = await db.nodes.where('projectId').equals(newId).toArray()
    const edges = await db.edges.where('projectId').equals(newId).toArray()
    expect(nodes).toHaveLength(exported.nodes.length)
    expect(edges).toHaveLength(exported.edges.length)
    const ids = new Set(nodes.map((x) => x.id))
    for (const e of edges) {
      expect(ids.has(e.source) && ids.has(e.target)).toBe(true)
    }
    // 元のプロジェクトは変更されない
    expect(await db.nodes.where('projectId').equals('kp_sample').count()).toBe(exported.nodes.length)
  })

  it('存在しないノードを指す接続線を含むファイルは拒否する', async () => {
    const exported = JSON.parse(JSON.stringify(await exportProject('kp_sample', db)))
    exported.edges.push({ id: 'x', projectId: 'kp_sample', source: 'missing', target: 'kn_1', relation: 'relates' })
    await expect(importProject(exported, 'u_creator', db)).rejects.toThrow(BackupError)
  })

  it('不正なノード種別は拒否する', async () => {
    const exported = JSON.parse(JSON.stringify(await exportProject('kp_sample', db)))
    exported.nodes[0].kind = 'script'
    await expect(importProject(exported, 'u_creator', db)).rejects.toThrow(BackupError)
  })
})
