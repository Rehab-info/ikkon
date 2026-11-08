import { expect, test } from "@playwright/test";
import { countIdb, startReal } from "./helpers";

test("デモモードは4領域を体験でき、変更は実データに混ざらない", async ({ page }) => {
  await startReal(page);
  await page.goto("/#/thanks/new");
  await page.getByLabel("何に感謝しているか").fill("REAL_ENTRY");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/#\/thanks$/);
  await expect(page.getByText("REAL_ENTRY")).toBeVisible();

  await page.goto("/#/settings");
  await page.getByRole("button", { name: "デモモードを始める" }).click();
  await expect(page.getByRole("link", { name: "デモモード" })).toBeVisible();

  await page.goto("/#/wellness");
  await page.getByText("30日", { exact: true }).click();
  await expect(page.getByText(/回答 \d+日 \/ 未回答 \d+日/)).toBeVisible();
  await page.goto("/#/intimacy?tab=boundaries");
  await expect(page.getByRole("heading", { name: "これは希望しない" })).toBeVisible();
  await page.goto("/#/food");
  await expect(page.getByText("小籠包")).toBeVisible();
  await page.goto("/#/thanks");
  await expect(page.getByText("誕生日を覚えていてくれた")).toBeVisible();
  await expect(page.getByText("REAL_ENTRY")).toHaveCount(0);

  // デモで追加・削除
  await page.goto("/#/thanks/new");
  await page.getByLabel("何に感謝しているか").fill("DEMO_ENTRY");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/#\/thanks$/);
  await expect(page.getByText("DEMO_ENTRY")).toBeVisible();
  expect(await countIdb(page, "yoku", "gratitude")).toBe(1);
  expect(await countIdb(page, "yoku", "wellness")).toBe(0);

  await page.goto("/#/settings");
  await page.getByRole("button", { name: "デモを終了して実データに戻る" }).click();
  await page.goto("/#/thanks");
  await expect(page.getByText("REAL_ENTRY")).toBeVisible();
  await expect(page.getByText("DEMO_ENTRY")).toHaveCount(0);
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(names).not.toContain("yoku-demo");
});
