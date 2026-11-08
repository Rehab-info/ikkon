import { chromium, devices, expect, test } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ORIGIN, startReal } from "./helpers";

test("ブラウザーを再起動してもデータが残る", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "yoku-profile-"));
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  const opts = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL: `${ORIGIN}/`, locale: "ja-JP" };
  try {
    let ctx = await chromium.launchPersistentContext(dir, opts);
    let page = ctx.pages()[0] ?? (await ctx.newPage());
    await startReal(page);
    await page.goto("/#/thanks/new");
    await page.getByLabel("何に感謝しているか").fill("再起動後も残る感謝");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page).toHaveURL(/#\/thanks$/);
    await expect(page.getByText("再起動後も残る感謝")).toBeVisible();
    await page.goto("/#/settings");
    const sw = page.getByRole("switch", { name: "性欲の項目を表示" });
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    // IndexedDB への書きこみが終わるのを待つ
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const req = indexedDB.open("yoku");
              req.onsuccess = () => {
                const g = req.result.transaction("settings").objectStore("settings").get("settings");
                g.onsuccess = () => {
                  req.result.close();
                  resolve(g.result?.value?.showSexualDesire === false);
                };
              };
            })
        )
      )
      .toBe(true);
    await ctx.close();

    ctx = await chromium.launchPersistentContext(dir, opts);
    page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto("/#/thanks");
    await expect(page.getByText("再起動後も残る感謝")).toBeVisible();
    await page.goto("/#/settings");
    await expect(page.getByRole("switch", { name: "性欲の項目を表示" })).toHaveAttribute("aria-checked", "false");
    await ctx.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("オフラインでも起動し、記録できる(Service Worker)", async ({ page, context }) => {
  await startReal(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Service Worker が画面を制御するまで待つ
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "今日の自分の状態" })).toBeVisible();
  await page.goto("/#/thanks/new");
  await page.getByLabel("何に感謝しているか").fill("オフラインの感謝");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/#\/thanks$/);
  await expect(page.getByText("オフラインの感謝")).toBeVisible();
  await page.goto("/#/wellness");
  await expect(page.getByRole("heading", { name: "推移" })).toBeVisible();
  await context.setOffline(false);
});
