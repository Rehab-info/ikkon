/**
 * Sprint 1 の E2E(TEST_PLAN §7 のうち認証・同意・担当に関わるもの)
 * 利用者・スタッフ・管理者をそれぞれ別のブラウザで操作する。
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { totp } from '../../../tests/integration/totp.ts';
import { ACCOUNTS_FILE, E2E_PASSWORD } from './global-setup.ts';

type Account = { id: string; email: string };
const accounts = () =>
  JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Record<'admin' | 'staff' | 'member', Account> & { tag: string };
const memberName = () => `E2E利用者-${accounts().tag}`;
const staffName = () => `E2Eスタッフ-${accounts().tag}`;

async function login(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'ログインする' }).click();
  return page;
}

async function enrollMfa(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: '2 段階認証' })).toBeVisible();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  await page.getByLabel('認証アプリに表示された 6 桁の数字').fill(totp(secret));
  await page.getByRole('button', { name: '確認する' }).click();
}

async function acceptAll(page: Page, count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    await expect(page.getByText(`${count} のうち ${i} 番目`)).toBeVisible();
    await page.getByRole('button', { name: i === count ? 'すべてに同意して始める' : '同意して次へ' }).click();
  }
}

async function noSeriousA11yViolations(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test.describe.serial('Sprint 1: login, consent and staff access', () => {
  let member: Page;
  let staff: Page;

  test('login page is accessible and does not reveal whether an account exists', async ({ page }) => {
    await page.goto('/');
    await noSeriousA11yViolations(page);
    await page.getByLabel('メールアドレス').fill('nobody@example.test');
    await page.getByLabel('パスワード').fill('wrong-password-1');
    await page.getByRole('button', { name: 'ログインする' }).click();
    await expect(page.getByRole('alert')).toHaveText(/ログインできませんでした/);
  });

  test('member signs in, reads and accepts the documents one by one', async ({ browser }) => {
    member = await login(browser, accounts().member.email);
    await acceptAll(member, 3);
    await expect(member.getByRole('heading', { name: 'ホーム' })).toBeVisible();
  });

  test('staff must enroll MFA, then sees the member with no consent', async ({ browser }) => {
    staff = await login(browser, accounts().staff.email);
    await enrollMfa(staff);
    await acceptAll(staff, 2);
    await expect(staff.getByRole('heading', { name: '担当の利用者' })).toBeVisible();
    await expect(staff.getByTestId('member-card')).toContainText(memberName());
    await expect(staff.getByTestId('member-card')).toContainText('同意なし');
  });

  test('member grants "view meals" after a confirmation; staff sees it', async () => {
    await member.getByRole('link', { name: '見せる情報', exact: true }).click();
    await expect(member.getByRole('heading', { name: '担当スタッフに見せる情報' })).toBeVisible();
    await noSeriousA11yViolations(member);
    const sw = member.getByRole('switch', { name: /^食事の記録を見る/ });
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await sw.click();
    await member.getByRole('alertdialog').getByRole('button', { name: '見せる' }).click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    // 代理入力は別の同意。閲覧を許しても代理入力はオフのまま
    await expect(member.getByRole('switch', { name: /^食事を代わりに記録する/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await staff.getByRole('button', { name: '最新の状態にする' }).click();
    await expect(staff.getByTestId('member-card')).toContainText('✓ 食事の記録を見る');
    await expect(staff.getByTestId('member-card')).not.toContainText('代わりに記録する');
  });

  test('member revokes; the staff session loses access on the next request', async () => {
    const sw = member.getByRole('switch', { name: /^食事の記録を見る/ });
    await sw.click();
    await expect(member.getByRole('alertdialog')).toContainText('すでに見た内容は取り消せません');
    await member.getByRole('alertdialog').getByRole('button', { name: 'やめる' }).click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    await staff.getByRole('button', { name: '最新の状態にする' }).click();
    await expect(staff.getByTestId('member-card')).toContainText('同意なし');
  });

  test('largest font size works on a 320px screen without horizontal scrolling', async () => {
    await member.getByRole('link', { name: '設定' }).click();
    await member.getByRole('radio', { name: /とても大きく/ }).click();
    await expect(member.locator('html')).toHaveAttribute('data-font-scale', '2');
    await member.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/settings', '/sharing', '/']) {
      await member.goto(path);
      await member.waitForLoadState('networkidle');
      const overflow = await member.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
    const button = member.getByRole('link', { name: '設定' });
    await expect(button).toBeVisible();
  });

  test('admin: MFA required, sees accounts and assignments but no health data or consent screens', async ({
    browser,
  }) => {
    const admin = await login(browser, accounts().admin.email);
    await enrollMfa(admin);
    await acceptAll(admin, 2);
    await expect(admin.getByRole('heading', { name: '利用者とスタッフ' })).toBeVisible();
    await expect(admin.getByTestId('admin-user').filter({ hasText: memberName() })).toBeVisible();
    await admin.getByRole('link', { name: '担当の割り当て' }).click();
    await expect(admin.getByTestId('assignment').filter({ hasText: `${staffName()} → ${memberName()}` })).toBeVisible();
    // 利用者向け画面には入れない
    await admin.goto('/sharing');
    await expect(admin).toHaveURL(/\/admin$/);
    await noSeriousA11yViolations(admin);
  });

  test('signing out returns to login and back navigation shows no data', async () => {
    await staff.getByRole('link', { name: '設定' }).click();
    await staff.getByRole('button', { name: 'ログアウト' }).click();
    await expect(staff.getByRole('button', { name: 'ログインする' })).toBeVisible();
    await staff.goBack();
    await expect(staff.getByText(memberName())).toHaveCount(0);
  });
});
