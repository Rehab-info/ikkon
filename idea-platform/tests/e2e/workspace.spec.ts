import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { switchUser } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await switchUser(page, 'u_creator', '/workspace')
})

test('知識マップにノードを追加・編集し、再読み込み後も保存されている', async ({ page }) => {
  await expect(page.getByTestId('project-title')).toContainText('通院の付き添い')
  await expect(page.getByTestId('knowledge-node')).toHaveCount(5)

  await page.getByRole('button', { name: /\+ 根拠/ }).click()
  await expect(page.getByTestId('knowledge-node')).toHaveCount(6)
  await page.getByLabel('ノードのラベル').fill('付き添い経験者の声（E2E）')
  await expect(page.getByTestId('save-status')).toContainText('保存しました')

  await page.reload()
  await expect(page.getByTestId('knowledge-node')).toHaveCount(6)
  await expect(page.getByTestId('knowledge-map')).toContainText('付き添い経験者の声（E2E）')
})

test('仮説に根拠を追加し、メモ・情報ソースを登録できる', async ({ page }) => {
  await page.getByRole('tab', { name: /仮説・反証/ }).click()
  const card = page.getByTestId('hypothesis-card').first()
  await card.getByLabel('根拠を追加').fill('待ち時間は平均2時間')
  await card.getByRole('button', { name: '追加' }).first().click()
  await expect(card).toContainText('根拠（1）')

  await page.getByRole('tab', { name: /メモ/ }).click()
  await page.getByLabel('新しいメモ').fill('E2Eで追加したメモ')
  await page.getByRole('button', { name: 'メモを追加' }).click()
  await expect(page.getByRole('list', { name: 'メモ一覧' })).toContainText('E2Eで追加したメモ')

  await page.getByRole('tab', { name: /情報ソース/ }).click()
  await page.getByLabel(/URL/).fill('javascript:alert(1)')
  await page.getByLabel(/タイトル/).fill('テスト資料')
  await page.getByRole('button', { name: '情報ソースを登録' }).click()
  await expect(page.getByText('http:// または https:// で始まるURL')).toBeVisible()
  await page.getByLabel(/URL/).fill('https://example.com/report')
  await page.getByRole('button', { name: '情報ソースを登録' }).click()
  await expect(page.getByRole('list', { name: '情報ソース一覧' })).toContainText('テスト資料')
})

test('プロジェクトを作成し、JSONエクスポートとインポートで復元できる', async ({ page }) => {
  await page.getByRole('button', { name: '新規プロジェクト' }).click()
  await page.getByLabel(/プロジェクト名/).fill('E2Eテストのプロジェクト')
  await page.getByRole('button', { name: '作成する' }).click()
  await expect(page.getByTestId('project-title')).toHaveText('E2Eテストのプロジェクト')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSONエクスポート' }).click()
  const download = await downloadPromise
  const path = await download.path()
  const json = JSON.parse(await readFile(path, 'utf8'))
  expect(json.kind).toBe('project')
  expect(json.project.title).toBe('E2Eテストのプロジェクト')

  await page.getByTestId('project-import-input').setInputFiles(path)
  await expect(page.getByTestId('project-title')).toHaveText('E2Eテストのプロジェクト（インポート）')
  await expect(page.getByTestId('knowledge-node')).toHaveCount(1)

  // 不正なファイルはエラー表示
  await page.getByTestId('project-import-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"x"}') })
  await expect(page.getByText('このアプリのバックアップファイルではありません。')).toBeVisible()
})

test('全体バックアップを書き出し、初期化後に復元できる', async ({ page }) => {
  await page.goto('/account?tab=data')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSONで書き出す' }).click()
  const path = await (await downloadPromise).path()

  page.on('dialog', (d) => d.accept())
  // 作成したプロジェクトが初期化で消え、復元で戻ることを確認
  await page.goto('/workspace')
  await page.getByRole('button', { name: '新規プロジェクト' }).click()
  await page.getByLabel(/プロジェクト名/).fill('バックアップ対象')
  await page.getByRole('button', { name: '作成する' }).click()
  await page.goto('/account?tab=data')
  const path2 = await (async () => {
    const p = page.waitForEvent('download')
    await page.getByRole('button', { name: 'JSONで書き出す' }).click()
    return (await p).path()
  })()
  await page.getByRole('button', { name: '初期化する' }).click()
  await expect(page.getByText('デモデータを初期状態に戻しました')).toBeVisible()
  await page.goto('/account?tab=projects')
  await expect(page.getByText('バックアップ対象')).toHaveCount(0)

  await page.goto('/account?tab=data')
  await page.getByTestId('backup-import-input').setInputFiles(path2)
  await expect(page.getByText('バックアップから復元しました')).toBeVisible()
  await page.goto('/account?tab=projects')
  await expect(page.getByText('バックアップ対象')).toBeVisible()
  expect(path).toBeTruthy()
})

test('ノードを移動し、ノード同士を接続できる（保存後も維持）', async ({ page, isMobile }) => {
  test.skip(isMobile, 'ドラッグ操作はデスクトップで確認')
  const map = page.getByTestId('knowledge-map')
  await map.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const edgesBefore = await map.locator('.react-flow__edge').count()

  // 移動
  const node = page.getByTestId('knowledge-node').filter({ hasText: '付き添い経験者5人に聞く' })
  const before = await node.boundingBox()
  await page.mouse.move(before!.x + 60, before!.y + 25)
  await page.mouse.down()
  await page.mouse.move(before!.x + 160, before!.y + 45, { steps: 8 })
  await page.mouse.up()
  const after = await node.boundingBox()
  expect(after!.x - before!.x).toBeGreaterThan(50)

  // 接続：課題ノードの下ハンドル → 実行計画ノードの上ハンドル
  const from = page.getByTestId('knowledge-node').filter({ hasText: '半日休む負担が大きい' }).locator('.react-flow__handle-bottom')
  const to = page.getByTestId('knowledge-node').filter({ hasText: '付き添い経験者5人に聞く' }).locator('.react-flow__handle-top')
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(map.locator('.react-flow__edge')).toHaveCount(edgesBefore + 1)
  await expect(page.getByTestId('save-status')).toContainText('保存しました')

  await page.reload()
  await expect(page.getByTestId('knowledge-map').locator('.react-flow__edge')).toHaveCount(edgesBefore + 1)
})
