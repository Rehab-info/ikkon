import { expect, test } from '@playwright/test'

const PATHS = ['/', '/ideas', '/ideas/idea-care-log', '/checkout/idea-care-log', '/creators/c_asakura', '/connect/c_asakura', '/workspace', '/account', '/admin', '/notice']

test('主要画面が横スクロールなしで表示される', async ({ page }) => {
  for (const p of PATHS) {
    await page.goto(p)
    await expect(page.locator('main')).toBeVisible()
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${p} の横方向のはみ出し`).toBeLessThanOrEqual(0)
  }
})

test('モバイルメニューで画面遷移できる', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'モバイル表示のみ')
  await page.goto('/')
  await page.getByRole('button', { name: 'メニューを開く' }).click()
  await expect(page.getByRole('navigation', { name: 'モバイル' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'モバイル' })).toBeHidden()
  await page.getByRole('button', { name: 'メニューを開く' }).click()
  await page.getByRole('navigation', { name: 'モバイル' }).getByRole('link', { name: 'マイページ' }).click()
  await expect(page).toHaveURL(/\/account/)
  await expect(page.getByRole('navigation', { name: 'モバイル' })).toBeHidden()
})
