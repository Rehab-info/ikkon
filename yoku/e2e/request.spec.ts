import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}
import { countIdb, expectNoHorizontalScroll, startReal, trackExternalRequests } from "./helpers";

test("Intimacy → 好きなプレイ → もう一度お願いしたい → メッセージ編集 → プレビュー → 共有(コピー)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const external = trackExternalRequests(page);
  // フェードイン中の半透明を色のコントラストとして誤検出しないように
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startReal(page);

  // 好きなプレイと、混ざってはいけない記録を用意
  await page.goto("/#/intimacy/preference/new?category=play");
  await page.getByLabel("名前").fill("ゆっくりマッサージ");
  await page.getByLabel("メモ").fill("NOTE_SECRET");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/tab=preferences/);
  await page.goto("/#/intimacy/preference/new?category=play");
  await page.getByLabel("名前").fill("OTHER_SECRET");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/tab=preferences/);

  // Intimacy → 好きなプレイ
  await page.goto("/#/");
  await page.getByRole("link", { name: /Intimacy/ }).first().click();
  const section = page.getByRole("region", { name: "好きなプレイ" });
  await expect(section.getByRole("listitem")).toHaveCount(2);
  while ((await section.getByRole("button", { name: "内容を表示" }).count()) > 0) await section.getByRole("button", { name: "内容を表示" }).first().click();
  await section.getByRole("link", { name: /ゆっくりマッサージ/ }).click();
  await expect(page.getByRole("heading", { name: "ゆっくりマッサージ" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(await axe(page)).toEqual([]);

  // もう一度お願いしたい
  await page.getByRole("link", { name: "もう一度お願いしたい" }).click();
  await expect(page.getByText("これは希望を伝えるメッセージです。", { exact: false }).first()).toBeVisible();
  const box = page.getByLabel("送る文章");
  await expect(box).toHaveValue(/^この前のゆっくりマッサージ、すごく嬉しかった。/);
  await page.getByText("少し照れながら", { exact: true }).click();
  await expect(box).toHaveValue(/^直接言うのはちょっと恥ずかしいけど、ゆっくりマッサージをまたお願いしたいな。/);
  await box.fill("ゆっくりマッサージ、またお願いしたいな。今度話そう");
  await expectNoHorizontalScroll(page);
  expect(await axe(page)).toEqual([]);

  // プレビュー
  await page.getByRole("button", { name: "確認へ進む" }).click();
  await expect(page.getByTestId("request-title")).toHaveText("ゆっくりマッサージ");
  await expect(page.getByTestId("share-preview")).toHaveText("ゆっくりマッサージ、またお願いしたいな。今度話そう");
  await expect(page.getByRole("button", { name: "文章をコピー" })).toBeDisabled();
  expect(await axe(page)).toEqual([]);
  await page.getByLabel("内容と送り先を確認しました").check();
  await page.getByRole("button", { name: "文章をコピー" }).click();
  await expect(page.getByText(/文章をコピーしました/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe("ゆっくりマッサージ、またお願いしたいな。今度話そう");
  expect(copied).not.toContain("NOTE_SECRET");
  expect(copied).not.toContain("OTHER_SECRET");

  // 元の記録は残り、下書きは保存されていない
  await page.getByRole("button", { name: "記録に戻る" }).click();
  await expect(page.getByRole("heading", { name: "ゆっくりマッサージ" })).toBeVisible();
  expect(await countIdb(page, "yoku", "intimacyPreferences")).toBe(2);
  const stores = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const r = indexedDB.open("yoku");
        r.onsuccess = () => {
          const names = Array.from(r.result.objectStoreNames);
          r.result.close();
          resolve(names);
        };
      })
  );
  expect(stores.sort()).toEqual(
    ["foods", "gratitude", "intimacyBoundaries", "intimacyMemories", "intimacyPreferences", "meta", "photos", "settings", "wellness"].sort()
  );
  expect(external).toEqual([]);
});

test("良かった体験からも作れる(デモ)", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("私は18歳以上です").check();
  await page.getByRole("button", { name: "デモデータで試してみる" }).click();
  await page.goto("/#/intimacy?tab=memories");
  await page.getByRole("button", { name: "内容を表示" }).first().click();
  await page.getByRole("link", { name: /雨の日曜日/ }).click();
  await page.getByRole("link", { name: "もう一度お願いしたい" }).click();
  await expect(page.getByLabel("送る文章")).toHaveValue(/この前の雨の日曜日、/);
  await expect(page.getByLabel("送る文章")).not.toHaveValue(/時間を気にせず/);
  await page.getByRole("button", { name: "やめる(何も送りません)" }).click();
  await expect(page.getByRole("heading", { name: "雨の日曜日" })).toBeVisible();
});
