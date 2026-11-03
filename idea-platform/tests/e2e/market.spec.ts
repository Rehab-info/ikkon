import { expect, test } from '@playwright/test'

test('アイデアを検索し、詳細を確認して購入デモを実行できる', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('アイデアが、人の可能性をひらく。')
  await page.getByRole('link', { name: 'アイデアを探す' }).first().click()
  await expect(page).toHaveURL(/\/ideas$/)

  // 非公開の本文だけに含まれる語では検索にかからない
  await page.getByRole('searchbox').fill('服薬')
  await expect(page.getByText('条件に合うアイデアが見つかりませんでした')).toBeVisible()
  // 検索
  await page.getByRole('searchbox').fill('介護')
  await expect(page.getByTestId('idea-card')).toHaveCount(1)
  // 該当なし → 空状態
  await page.getByRole('searchbox').fill('存在しないキーワードxyz')
  await expect(page.getByText('条件に合うアイデアが見つかりませんでした')).toBeVisible()
  await page.getByRole('button', { name: '条件をリセット' }).click()
  // カテゴリー絞り込み
  await page.getByRole('button', { name: '環境', exact: true }).click()
  await expect(page.getByTestId('idea-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'すべて' }).click()

  await page.getByRole('searchbox').fill('介護')
  await page.getByRole('link', { name: /申し送り/ }).click()
  // 購入前は中身（概要・課題の詳細・差異・知識マップ）を表示しない
  await expect(page.getByTestId('locked-content')).toBeVisible()
  await expect(page.getByRole('heading', { name: '想定顧客' })).toBeVisible()
  for (const name of ['概要', '解決する課題', '既存手段との差異', '知識マップ（概要）']) {
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0)
  }
  await expect(page.getByText(/連絡手段が電話・メモ/)).toHaveCount(0)
  await expect(page.getByTestId('knowledge-node')).toHaveCount(0)
  await expect(page.getByText(/独占的な特許権を購入/)).toHaveCount(0)

  await page.getByRole('link', { name: '購入手続きへ（デモ）' }).click()
  await expect(page.getByRole('heading', { name: '購入確認（デモ）' })).toBeVisible()
  await expect(page.getByText('￥30,000').first()).toBeVisible()

  // チェックなしでは実行できない
  await page.getByRole('button', { name: '購入デモを実行' }).click()
  await expect(page.getByRole('alert')).toContainText('すべての確認項目')

  for (const box of await page.getByRole('checkbox').all()) await box.check()
  await page.getByRole('button', { name: '購入デモを実行' }).click()
  await expect(page.getByTestId('purchase-demo-complete')).toContainText('これは購入体験のデモです。決済は行われていません。')

  // 購入デモ後は詳細が表示される
  await page.goto('/ideas/idea-care-log')
  await expect(page.getByRole('heading', { name: '解決する課題', exact: true })).toBeVisible()
  await expect(page.getByText(/連絡手段が電話・メモ/)).toBeVisible()
  await expect(page.getByTestId('locked-content')).toHaveCount(0)

  await page.goto('/account?tab=purchases')
  await expect(page.getByTestId('purchase-list')).toContainText('申し送り')
})

test('非公開期間中のアイデアは購入できない', async ({ page }) => {
  await page.goto('/ideas/idea-shop-memory')
  await expect(page.getByText('現在、購入を受け付けていません')).toBeVisible()
  await page.goto('/checkout/idea-shop-memory')
  await expect(page.getByText('このアイデアは現在購入できません')).toBeVisible()
})

test('審査中のアイデアは一般の利用者には表示されない', async ({ page }) => {
  await page.goto('/ideas/idea-craft-rental')
  await expect(page.getByText('アイデアが見つかりません')).toBeVisible()
})
