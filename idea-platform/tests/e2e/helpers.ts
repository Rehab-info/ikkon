import type { Page } from '@playwright/test'

/** デモ利用者を切り替えて再読み込みする（ヘッダーの切り替えと同じ保存先を使用） */
export async function switchUser(page: Page, id: 'u_buyer' | 'u_creator' | 'u_admin', path?: string) {
  await page.evaluate((v) => localStorage.setItem('idea-platform:demo-user', v), id)
  if (path) await page.goto(path)
  else await page.reload()
}
