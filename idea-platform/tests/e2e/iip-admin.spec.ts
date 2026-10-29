import { expect, test } from '@playwright/test'
import { switchUser } from './helpers'

test('IIPを作成・プレビューし、審査申請 → 運営が承認すると一覧に公開される', async ({ page }) => {
  await page.goto('/')
  await switchUser(page, 'u_creator', '/workspace?project=kp_sample&tab=structure')
  await page.getByRole('button', { name: 'このプロジェクトからIIPを作成' }).click()
  await expect(page).toHaveURL(/\/workspace\/iip\//)

  const isMobile = (page.viewportSize()?.width ?? 1000) < 1024
  await page.getByLabel(/^タイトル/).fill('通院付き添いの交代制シェア')
  await page.getByLabel(/一文紹介/).fill('通院の待ち時間だけを、近所の人と交代で見守る仕組み。')
  await page.getByLabel(/想定顧客/).fill('通院の付き添いが必要な家族、地域の支援団体')
  await page.getByLabel(/アイデア概要/).fill('通院の付き添いのうち、待ち時間の見守りだけを交代できるようにする仕組みの構想です。')
  await page.getByLabel(/提案内容/).fill('待ち時間の見守りを、事前に登録した近所の人と交代できるようにします。')

  // 誤解を生む表現は申請できない
  await page.getByLabel(/競合分析/).fill('独占的な権利が得られる点が強みです。')
  await page.getByRole('button', { name: '出品審査を申請する' }).click()
  await expect(page.getByTestId('iip-errors')).toContainText('誤解を生む権利表示')
  await page.getByLabel(/競合分析/).fill('既存の家事代行と異なり、待ち時間の見守りに限定している。')

  // プレビュー
  if (isMobile) await page.getByRole('button', { name: 'プレビュー', exact: true }).click()
  await expect(page.getByTestId('iip-preview')).toContainText('通院付き添いの交代制シェア')
  if (isMobile) await page.getByRole('button', { name: '編集', exact: true }).click()

  await page.getByRole('button', { name: '出品審査を申請する' }).click()
  await expect(page.getByText('出品審査を申請済みです（デモ）')).toBeVisible()

  // 運営が承認
  await switchUser(page, 'u_admin', '/admin?tab=reviews')
  await expect(page.getByText('本番の認証・認可は実装されていません')).toBeVisible()
  const item = page.getByTestId('review-item').filter({ hasText: '通院付き添いの交代制シェア' })
  await item.getByRole('button', { name: '承認して公開' }).click()
  await expect(item.getByRole('alert')).toContainText('すべての項目')
  for (const box of await item.getByRole('checkbox').all()) await box.check()
  await item.getByRole('button', { name: '承認して公開' }).click()
  await expect(item).toContainText('承認')

  await page.goto('/ideas')
  await expect(page.getByRole('link', { name: '通院付き添いの交代制シェア' })).toBeVisible()

  await page.goto('/admin')
  await expect(page.getByTestId('kpi-grid')).toContainText('デモ取引額')
})

test('購入者には運営画面の内容が表示されない', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByText('運営（デモ）ロールでのみ表示されます')).toBeVisible()
  await expect(page.getByTestId('kpi-grid')).toHaveCount(0)
})
