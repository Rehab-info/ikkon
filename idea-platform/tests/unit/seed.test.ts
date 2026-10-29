import { describe, expect, it } from 'vitest'
import { DEMO_CREATORS, DEMO_IDEAS, DEMO_USERS, STANDARD_PRICE } from '../../src/data/seed'
import { escapeHtml, buildIipHtml } from '../../src/lib/iipHtml'
import { validatePackageForSubmission } from '../../src/db/repo'
import { IIP_SECTION_KEYS, type IdeaPackage } from '../../src/types'

describe('デモデータ', () => {
  it('アイデア6件以上・創作者5人以上', () => {
    expect(DEMO_IDEAS.length).toBeGreaterThanOrEqual(6)
    expect(DEMO_CREATORS.length).toBeGreaterThanOrEqual(5)
  })
  it('すべてのアイデアの創作者が存在する', () => {
    const ids = new Set(DEMO_CREATORS.map((c) => c.id))
    for (const i of DEMO_IDEAS) expect(ids.has(i.creatorId)).toBe(true)
  })
  it('価格は標準価格30,000円', () => {
    expect(STANDARD_PRICE).toBe(30000)
    for (const i of DEMO_IDEAS) expect(i.price).toBe(30000)
  })
  it('誤解を生む権利表示（特許権を購入できる等）がない', () => {
    const text = JSON.stringify(DEMO_IDEAS)
    expect(text).not.toMatch(/特許権を(購入|取得)|独占的(な)?(特許|権利)を(購入|取得)/)
  })
  it('連絡先（メールアドレス・電話番号）を含まない', () => {
    const text = JSON.stringify([DEMO_IDEAS, DEMO_CREATORS, DEMO_USERS])
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    expect(text).not.toMatch(/0\d{1,4}-\d{1,4}-\d{3,4}/)
  })
})

describe('IIP', () => {
  const base: IdeaPackage = {
    id: 'iip_1',
    ownerId: 'u_creator',
    title: '<script>alert(1)</script>テスト',
    category: '生活',
    catchcopy: '十分な長さの一文紹介です。',
    targetCustomers: '想定顧客',
    sections: Object.fromEntries(IIP_SECTION_KEYS.map((k) => [k, '十分な長さの本文をここに書きます。'])) as IdeaPackage['sections'],
    linkedNodeIds: [],
    status: 'draft',
    createdAt: '',
    updatedAt: '',
  }

  it('HTML出力はユーザー入力をエスケープする', () => {
    const html = buildIipHtml(base, '作成者')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain(escapeHtml('<script>alert(1)</script>'))
  })
  it('必須項目が揃っていれば審査申請できる', () => {
    expect(validatePackageForSubmission(base)).toEqual([])
  })
  it('誤解を生む権利表示を含むと申請できない', () => {
    const errors = validatePackageForSubmission({ ...base, catchcopy: '独占的な権利を得られるアイデアです' })
    expect(errors.join()).toMatch(/誤解を生む権利表示/)
  })
  it('未入力の必須項目を指摘する', () => {
    const errors = validatePackageForSubmission({ ...base, sections: { ...base.sections, risks: '' } })
    expect(errors.join()).toMatch(/リスク/)
  })
})
