/**
 * Sprint 2 の E2E:食事記録(写真 → 解析(開発用の仮解析)→ 要確認の修正 → 保存 → 再表示)、代理入力、同意撤回
 * すべて架空のアカウントとデータ。
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { totp } from '../../../tests/integration/totp.ts';
import { ACCOUNTS_FILE, E2E_PASSWORD } from './global-setup.ts';

type Account = { id: string; email: string };
const accounts = () =>
  JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Record<'mealMember' | 'mealStaff', Account> & { tag: string };

async function login(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'ログインする' }).click();
  return page;
}

/** ブラウザで本物の JPEG を作る(写真の代わり) */
async function photoFile(page: Page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c8a26b';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(120, 150, 80, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const x of buf) s += String.fromCharCode(x);
    return btoa(s);
  });
  return { name: 'meal.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

const panel = (page: Page) => page.getByTestId('nutrition-panel');

test.describe.serial('Sprint 2: 食事記録', () => {
  let member: Page;
  let staff: Page;
  let savedEnergy = '';

  test('本人:写真から記録 → 要確認があると「確認済み食品のみの小計」と表示される', async ({ browser }) => {
    member = await login(browser, accounts().mealMember.email);
    await member.getByRole('link', { name: 'ごはんを記録する' }).click();
    await member.getByRole('button', { name: '夕ごはん' }).click();
    await member.getByRole('button', { name: '次へ' }).click();
    await member.getByRole('button', { name: '自宅で食べた' }).click();
    await member.getByTestId('photo-input').setInputFiles(await photoFile(member));

    await expect(member.getByRole('heading', { name: '食べたものと量の確認' })).toBeVisible();
    await expect(member.getByTestId('mock-banner')).toBeVisible();
    await expect(member.getByTestId('needs-review')).toHaveCount(3); // 豚肉・サラダ油・豆腐
    await expect(panel(member)).toHaveAttribute('data-scope', 'confirmed_only_subtotal');
    await expect(member.getByTestId('nutrition-heading')).toHaveText('確認済み食品のみの小計');
    await expect(panel(member)).toContainText('未確認の食品は含まれていません。(未確認 3 品)');
    await expect(panel(member)).not.toContainText('推定摂取量');
    await expect(member.getByTestId('nutrition-energy_kcal')).toContainText('小計');
  });

  test('本人:量・食べた割合を直すと再計算され、要確認のまま保存すると小計として保存される', async () => {
    const before = await member.getByTestId('nutrition-energy_kcal').textContent();
    const rice = member.getByTestId('meal-line').filter({ hasText: 'こめ' });
    await rice.getByRole('button', { name: '半分' }).click();
    await expect(member.getByTestId('nutrition-energy_kcal')).not.toHaveText(before ?? '');
    await rice.getByRole('button', { name: 'こめ 水稲めし 精白米 うるち米を多く' }).click();

    await member.getByRole('button', { name: '確認へ' }).click();
    await expect(member.getByTestId('save-with-review')).toContainText('要確認の食品が 3 品あります');
    await member.getByRole('button', { name: 'この内容で保存する' }).click();
    await expect(member.getByTestId('saved-line').filter({ hasText: '要確認' })).toHaveCount(3);
    await expect(member.getByTestId('nutrition-heading')).toHaveText('確認済み食品のみの小計');
    await expect(panel(member)).toContainText('未確認の食品は含まれていません');
  });

  test('本人:要確認の食品を直し、材料を足すと「推定摂取量」になり、保存・再表示で値が一致する', async () => {
    await member.getByRole('button', { name: '要確認の食品を直す' }).click();
    for (let i = 0; i < 3; i++) {
      const line = member
        .getByTestId('meal-line')
        .filter({ has: member.getByTestId('needs-review') })
        .first();
      await line.getByTestId('needs-review').getByRole('button').first().click();
    }
    await expect(member.getByTestId('needs-review')).toHaveCount(0);
    // 調味料を足す(肉じゃがに みりん)
    const dish = member.getByTestId('dish-card').filter({ hasText: '肉じゃが' });
    await dish.getByRole('button', { name: '+ 調味料を足す' }).click();
    await dish.getByLabel('足す調味料').fill('みりん');
    await dish.getByRole('button', { name: '探す' }).click();
    await dish.getByRole('list', { name: '見つかった食品' }).getByRole('button').first().click();
    await expect(dish.getByTestId('meal-line')).toHaveCount(8);

    await expect(member.getByTestId('nutrition-heading')).toHaveText('推定摂取量');
    await expect(panel(member)).not.toContainText('未確認');
    const editing = await member.getByTestId('nutrition-energy_kcal').textContent();
    await member.getByRole('button', { name: '直した内容で保存する' }).click();

    // 詳細画面(保存済みの記録)に戻ったことを確かめてから読む
    await expect(member.getByRole('button', { name: 'この記録を直す' })).toBeVisible();
    await expect(member.getByTestId('saved-line').filter({ hasText: '要確認' })).toHaveCount(0);
    await expect(member.getByTestId('nutrition-heading')).toHaveText('推定摂取量');
    savedEnergy = (await member.getByTestId('nutrition-energy_kcal').textContent()) ?? '';
    expect(savedEnergy).toBe(editing);
    const all = await panel(member).locator('dd').allTextContents();
    await member.reload();
    await expect(member.getByTestId('nutrition-heading')).toHaveText('推定摂取量');
    expect(await panel(member).locator('dd').allTextContents()).toEqual(all);
  });

  test('本人:一覧に「記録済みの自宅食事の推定摂取量」と記録が出る。朝を「食べなかった」にできる', async () => {
    await member.getByRole('button', { name: '記録の一覧へ' }).click();
    const today = member.getByTestId('day-card').first();
    await expect(today.getByTestId('day-total-heading')).toHaveText('記録済みの自宅食事の推定摂取量');
    await expect(today.getByTestId('meal-link')).toContainText('夕ごはん:推定摂取量');

    await member.getByRole('link', { name: 'ごはんを記録する' }).click();
    await member.getByRole('button', { name: '朝ごはん' }).click();
    await member.getByRole('button', { name: '次へ' }).click();
    await member.getByRole('button', { name: '食べなかった' }).click();
    await expect(member.getByRole('status')).toContainText('食べなかった');
    await member.getByRole('link', { name: 'ホーム' }).click();
    await expect(member.getByTestId('today-slots')).toContainText('朝ごはん:ー 食べなかった');
    await expect(member.getByTestId('today-slots')).toContainText('昼ごはん:まだ記録していません');
  });

  test('担当スタッフ:写真なしで代理入力でき、本人の画面に「スタッフ入力」と出る', async ({ browser }) => {
    staff = await login(browser, accounts().mealStaff.email);
    await expect(staff.getByRole('heading', { name: '2 段階認証' })).toBeVisible();
    const secret = (await staff.getByTestId('totp-secret').textContent())?.trim() ?? '';
    await staff.getByLabel('認証アプリに表示された 6 桁の数字').fill(totp(secret));
    await staff.getByRole('button', { name: '確認する' }).click();

    await staff.getByRole('link', { name: '食事を代わりに記録する' }).click();
    await expect(staff.getByTestId('proxy-banner')).toContainText(
      `食事テスト利用者-${accounts().tag} さんの記録として`,
    );
    await staff.getByRole('button', { name: '昼ごはん' }).click();
    await staff.getByRole('button', { name: '次へ' }).click();
    await staff.getByRole('button', { name: '自宅で食べた' }).click();
    await staff.getByRole('button', { name: '写真なしで記録する' }).click();
    await staff.getByRole('button', { name: '+ 食べものを足す' }).click();
    await staff.getByLabel('食べものの名前').fill('ごはん');
    await staff.getByRole('button', { name: '探す' }).click();
    await staff.getByRole('list', { name: '見つかった食品' }).getByRole('button').first().click();
    await expect(staff.getByTestId('nutrition-heading')).toHaveText('推定摂取量');
    await staff.getByRole('button', { name: '確認へ' }).click();
    await staff.getByRole('button', { name: 'この内容で保存する' }).click();
    await expect(staff.getByTestId('staff-entry')).toBeVisible();
    // スタッフには食事の写真を見せない(D-09)
    await expect(staff.getByRole('img', { name: '記録した食事の写真' })).toHaveCount(0);

    await member.getByRole('link', { name: '記録', exact: true }).click();
    await expect(member.getByTestId('meal-link').filter({ hasText: '昼ごはん' })).toContainText('スタッフ入力');
  });

  test('同意撤回:代理入力をやめると、開いたままのスタッフの画面からの保存も拒否される', async () => {
    // スタッフは入力画面を開いたまま
    await staff.goto(`/members/${accounts().mealMember.id}/meals/new`);
    await staff.getByRole('button', { name: '間食' }).click();
    await staff.getByRole('button', { name: '次へ' }).click();
    await staff.getByRole('button', { name: '自宅で食べた' }).click();
    await staff.getByRole('button', { name: '写真なしで記録する' }).click();
    await staff.getByRole('button', { name: '+ 食べものを足す' }).click();
    await staff.getByLabel('食べものの名前').fill('バナナ');
    await staff.getByRole('button', { name: '探す' }).click();
    await staff.getByRole('list', { name: '見つかった食品' }).getByRole('button').first().click();
    await staff.getByRole('button', { name: '確認へ' }).click();

    // 本人が「食事を代わりに記録する」と「食事の記録を見る」をやめる
    await member.getByRole('link', { name: '見せる情報' }).click();
    for (const name of [/^食事を代わりに記録する/, /^食事の記録を見る/]) {
      const sw = member.getByRole('switch', { name });
      await sw.click();
      await member.getByRole('alertdialog').getByRole('button', { name: 'やめる' }).click();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
    }

    await staff.getByRole('button', { name: 'この内容で保存する' }).click();
    await expect(staff.getByRole('alert')).toContainText('この操作はできません');
    await staff.goto(`/members/${accounts().mealMember.id}/meals`);
    await expect(staff.getByRole('alert')).toContainText('この操作はできません');
    await staff.goto('/staff');
    await expect(staff.getByRole('link', { name: '食事を代わりに記録する' })).toHaveCount(0);
  });
});
