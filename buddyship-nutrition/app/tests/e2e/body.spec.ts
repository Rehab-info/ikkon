/**
 * Sprint 3 の E2E:InBody(体組成)の記録・グラフ・表、担当スタッフのダッシュボードと代理入力、担当外・同意撤回
 * すべて架空のアカウントと架空の測定値。
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { totp } from '../../../tests/integration/totp.ts';
import { ACCOUNTS_FILE, E2E_PASSWORD } from './global-setup.ts';

type Account = { id: string; email: string };
const accounts = () =>
  JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Record<'bodyMember' | 'bodyStaff' | 'otherStaff', Account> & {
    tag: string;
  };

async function login(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'ログインする' }).click();
  return page;
}

async function loginStaff(browser: Browser, email: string): Promise<Page> {
  const page = await login(browser, email);
  await expect(page.getByRole('heading', { name: '2 段階認証' })).toBeVisible();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  await page.getByLabel('認証アプリに表示された 6 桁の数字').fill(totp(secret));
  await page.getByRole('button', { name: '確認する' }).click();
  await expect(page.getByRole('heading', { name: '担当の利用者' })).toBeVisible();
  return page;
}

/** 日本時間で n 日前の 9:00(datetime-local の値) */
const daysAgoLocal = (n: number) => {
  const d = new Date(Date.now() + 9 * 3600_000 - n * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T09:00`;
};

/** 測定値を 1 問ずつ入れて保存する */
async function enterBody(
  page: Page,
  v: { weight: string; muscle: string; fatKg: string; fatPct: string; when?: string; device?: string },
  opts: { expectWarning?: boolean } = {},
) {
  for (const [label, value] of [
    ['体重', v.weight],
    ['骨格筋量', v.muscle],
    ['体脂肪量', v.fatKg],
    ['体脂肪率', v.fatPct],
  ] as const) {
    await expect(page.getByRole('heading', { name: new RegExp(`${label}は?`) })).toBeVisible();
    await page.getByLabel(`結果用紙の「${label}」の数字`).fill(value);
    await page.getByRole('button', { name: '次へ' }).click();
  }
  if (v.when) await page.getByLabel('測った日と時刻').fill(v.when);
  await page.getByRole('button', { name: '次へ' }).click();
  if (v.device) await page.getByLabel(/機種/).fill(v.device);
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('radio', { name: /食事の前/ }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByTestId('body-confirm')).toContainText(`${v.weight} kg`);
  await expect(page.getByTestId('body-warning')).toHaveCount(opts.expectWarning ? 1 : 0);
  await page.getByRole('button', { name: /保存する$/ }).click();
  await expect(page.getByTestId('body-saved')).toContainText('保存しました');
}

const EVALUATIVE = /低栄養|サルコペニア|不足|過剰|良好|危険|要注意|肥満|やせ/;

test.describe.serial('Sprint 3: 体の測定(InBody)', () => {
  let member: Page;
  let staff: Page;

  test('本人:1 問ずつ入力して保存。範囲外は次へ進めない', async ({ browser }) => {
    member = await login(browser, accounts().bodyMember.email);
    await member.getByRole('link', { name: '体の測定を記録する' }).click();
    await member.getByLabel('結果用紙の「体重」の数字').fill('19.9');
    await expect(member.getByRole('alert')).toContainText('20〜300 kg の間で入れてください');
    await expect(member.getByRole('button', { name: '次へ' })).toBeDisabled();
    await member.getByLabel('結果用紙の「体重」の数字').fill('52.44');
    await expect(member.getByRole('alert')).toContainText('小数は 1 けたまで');
    await member.getByRole('button', { name: '戻る' }).click();

    await member.getByRole('link', { name: '体の測定を記録する' }).click();
    await enterBody(member, {
      weight: '52.4',
      muscle: '19.8',
      fatKg: '16.1',
      fatPct: '30.7',
      when: daysAgoLocal(10),
      device: 'InBody(架空の機種A)',
    });
  });

  test('本人:機種が変わり、体脂肪率が合わないと警告(保存はできる)。グラフは指標ごとに別、注記つき', async () => {
    await member.getByRole('link', { name: '体の測定を記録する' }).click();
    // 機種の初期値は前回の機種。別の機種に変える
    await enterBody(
      member,
      { weight: '52.0', muscle: '19.9', fatKg: '15.6', fatPct: '35.0', device: 'InBody(架空の機種B)' },
      { expectWarning: true },
    );
    for (const m of ['weight_kg', 'skeletal_muscle_kg', 'body_fat_pct']) {
      await expect(member.getByTestId(`chart-${m}`)).toBeVisible();
      await expect(member.getByTestId(`chart-${m}`).locator('svg.recharts-surface')).toBeVisible();
    }
    await expect(member.getByTestId('chart-weight_kg')).toContainText('体重(kg)');
    await expect(member.getByTestId('chart-body_fat_pct')).toContainText('体脂肪率(%)');
    await expect(member.getByTestId('device-note')).toBeVisible();
    await expect(member.getByTestId('body-notes')).toContainText('良い・悪いを判断するものではありません');
    expect(await member.locator('main').textContent()).not.toMatch(EVALUATIVE);
    await expect(member.getByTestId('body-record')).toHaveCount(2);

    await member.getByRole('button', { name: '表で見る' }).click();
    const table = member.getByTestId('body-table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.locator('tbody tr').first()).toContainText('−0.4 kg');
    const axe = await new AxeBuilder({ page: member })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await member.getByRole('button', { name: 'グラフで見る' }).click();
  });

  test('本人:修正すると変更の履歴に前の値が残る', async () => {
    const latest = member.getByTestId('body-record').first();
    await latest.getByRole('link', { name: 'この記録を直す' }).click();
    await member.getByLabel('結果用紙の「体重」の数字').fill('52.1');
    for (let i = 0; i < 7; i++) await member.getByRole('button', { name: '次へ' }).click();
    await member.getByRole('button', { name: '直した内容で保存する' }).click();
    await expect(member.getByTestId('body-saved')).toContainText('保存しました');
    const rec = member.getByTestId('body-record').first();
    await expect(rec).toContainText('体重 52.1 kg');
    await expect(rec).toContainText('修正あり');
    await rec.getByRole('button', { name: '変更の履歴' }).click();
    const history = rec.getByTestId('body-history');
    await expect(history.locator('li')).toHaveCount(2);
    await expect(history.locator('li').first()).toContainText('体重 52.0');
    await expect(history.locator('li').nth(1)).toContainText('体重 52.1');
  });

  test('担当スタッフ:ダッシュボードに最終記録日(未記録)と InBody の測定日。代理入力が本人の画面に出る', async ({
    browser,
  }) => {
    staff = await loginStaff(browser, accounts().bodyStaff.email);
    const card = staff.getByTestId('member-card').filter({ hasText: `体テスト利用者-${accounts().tag}` });
    await expect(card.getByTestId('last-meal')).toHaveText('未記録');
    await expect(card.getByTestId('last-body')).not.toHaveText(/未記録|同意なし/);
    await expect(card.getByTestId('week-grid')).toBeVisible();
    expect(await card.textContent()).not.toMatch(/52\.|kg/); // 値は一覧に出さない

    await card.getByRole('link', { name: '体の測定を代わりに記録する' }).click();
    await expect(staff.getByTestId('proxy-banner')).toContainText(`体テスト利用者-${accounts().tag} さんの記録として`);
    await enterBody(staff, { weight: '52.3', muscle: '19.9', fatKg: '15.8', fatPct: '30.2' });
    await expect(staff.getByTestId('body-record')).toHaveCount(3);
    await expect(staff.getByRole('button', { name: 'この記録を消す' })).toHaveCount(0); // 削除は本人だけ

    await member.reload();
    await expect(member.getByTestId('staff-entry').first()).toContainText(`体テストスタッフ-${accounts().tag}`);
  });

  test('担当外のスタッフは見られない', async ({ browser }) => {
    const other = await loginStaff(browser, accounts().otherStaff.email);
    await other.goto(`/members/${accounts().bodyMember.id}/body`);
    await expect(other.getByRole('alert')).toContainText('この操作はできません');
    await expect(other.getByTestId('chart-weight_kg')).toHaveCount(0);
  });

  test('同意撤回:体の測定を見せるのをやめると、スタッフのダッシュボードは「同意なし」になり、画面も拒否される', async () => {
    await member.getByRole('link', { name: '見せる情報' }).click();
    for (const name of [/^体の測定を代わりに記録する/, /^体の測定を見る/]) {
      const sw = member.getByRole('switch', { name });
      await sw.click();
      await member.getByRole('alertdialog').getByRole('button', { name: 'やめる' }).click();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
    }
    await staff.goto('/staff');
    const card = staff.getByTestId('member-card').filter({ hasText: `体テスト利用者-${accounts().tag}` });
    await expect(card.getByTestId('last-body')).toHaveText('—(同意なし)');
    await expect(card.getByTestId('last-meal')).toHaveText('未記録'); // 食事の同意は残っている
    await expect(card.getByRole('link', { name: '体の変化を見る' })).toHaveCount(0);
    await staff.goto(`/members/${accounts().bodyMember.id}/body`);
    await expect(staff.getByText('この方の体の測定を見る同意がありません。')).toBeVisible();
  });
});
