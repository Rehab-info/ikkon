import { expect, type Page } from "@playwright/test";

export const ORIGIN = "http://localhost:4173";

/** ページが外部へ出したリクエストを集める(blob: / data: と同一オリジン以外) */
export function trackExternalRequests(page: Page): string[] {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(ORIGIN) && !url.startsWith("blob:") && !url.startsWith("data:")) external.push(url);
  });
  return external;
}

export async function startReal(page: Page) {
  await page.goto("/");
  await page.getByLabel("私は18歳以上です").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByRole("heading", { name: "今日の自分の状態" })).toBeVisible();
}

export async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByLabel("私は18歳以上です").check();
  await page.getByRole("button", { name: "デモデータで試してみる" }).click();
  await expect(page.getByRole("link", { name: "デモモード" })).toBeVisible();
}

/** IndexedDB の中身を直接数える(テスト用) */
export async function countIdb(page: Page, dbName: string, store: string): Promise<number> {
  return page.evaluate(
    ([name, st]) =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open(name!);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(st!)) {
            db.close();
            resolve(0);
            return;
          }
          const c = db.transaction(st!, "readonly").objectStore(st!).count();
          c.onsuccess = () => {
            db.close();
            resolve(c.result);
          };
        };
      }),
    [dbName, store]
  );
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
