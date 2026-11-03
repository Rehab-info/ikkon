import { expect, test } from '@playwright/test'
import { switchUser } from './helpers'

test('創作者に相談を申請し、創作者が承諾すると双方同意になる', async ({ page }) => {
  await page.goto('/ideas/idea-stock-guide')
  await page.getByRole('link', { name: 'プロフィールを見る' }).click()
  await expect(page.getByRole('heading', { name: '西田 拓海' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '思考スタイル' })).toBeVisible()
  await page.getByRole('link', { name: '相談を申し込む' }).click()

  // 入力検証
  await page.getByRole('button', { name: '入力内容を確認する' }).click()
  await expect(page.getByText('相談目的を選択してください。')).toBeVisible()

  await page.getByLabel('共同開発を相談したい').check()
  await page.getByLabel(/相談内容/).fill('連絡先は test@example.com です。よろしくお願いします。詳しく伺いたいです。')
  await page.getByLabel(/希望する協力形態/).selectOption({ index: 1 })
  await page.getByRole('button', { name: '入力内容を確認する' }).click()
  await expect(page.getByText(/メールアドレスや電話番号は記載しないでください/)).toBeVisible()

  await page.getByLabel(/相談内容/).fill('仕入れ判断カードを当社の店舗で試せないか、共同での検証についてご相談したいです。')
  await page.getByRole('button', { name: '入力内容を確認する' }).click()
  await expect(page.getByRole('heading', { name: '申請内容の確認' })).toBeVisible()
  await page.getByRole('button', { name: /この内容で申請する/ }).click()
  await expect(page.getByTestId('connection-done')).toContainText('創作者の返答待ち')

  // 創作者として返答（西田さんはデモ創作者ではないため、seed の朝倉さん宛て申請で確認）
  await switchUser(page, 'u_creator', '/account?tab=inbox')
  const row = page.getByTestId('connection-row').first()
  await expect(row).toContainText('創作者の返答待ち')
  await row.getByRole('button', { name: '承諾する（同意）' }).click()
  await expect(row).toContainText('双方同意済み')

  await switchUser(page, 'u_admin', '/admin?tab=connections')
  await expect(page.getByRole('table')).toContainText('双方同意済み')
  await expect(page.getByRole('table')).toContainText('創作者の返答待ち')
})

test('受付停止中の創作者には申請できない', async ({ page }) => {
  await page.goto('/connect/c_aoi')
  await expect(page.getByText('現在、相談の受付を停止しています')).toBeVisible()
})
