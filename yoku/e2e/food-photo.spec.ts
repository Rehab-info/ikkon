import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countIdb, startReal } from "./helpers";

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "exif-gps.jpg");

test("料理の写真を縮小して端末内に保存し、EXIF(位置情報)を取り除き、削除で写真も消える", async ({ page }) => {
  await startReal(page);
  await page.goto("/#/food/new");
  await page.getByLabel("料理名").fill("写真つきの料理");
  await page.getByTestId("food-photo-input").setInputFiles(FIXTURE);
  await expect(page.getByText(/縮小済み:1600×1200/)).toBeVisible();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("img", { name: "写真つきの料理の写真" })).toBeVisible();
  expect(await countIdb(page, "yoku", "photos")).toBe(1);

  const info = await page.evaluate(
    () =>
      new Promise<{ size: number; width: number; height: number; type: string; hasExif: boolean; hasMarker: boolean }>((resolve) => {
        const req = indexedDB.open("yoku");
        req.onsuccess = () => {
          const g = req.result.transaction("photos").objectStore("photos").getAll();
          g.onsuccess = async () => {
            const p = g.result[0];
            const bytes = new Uint8Array(await (p.blob as Blob).arrayBuffer());
            const text = new TextDecoder("latin1").decode(bytes);
            req.result.close();
            resolve({
              size: p.size,
              width: p.width,
              height: p.height,
              type: p.type,
              hasExif: text.includes("Exif\u0000\u0000"),
              hasMarker: text.includes("YOKU_EXIF")
            });
          };
        };
      })
  );
  expect(info.type).toBe("image/jpeg");
  expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(1600);
  expect(info.size).toBeLessThan(1.5 * 1024 * 1024);
  expect(info.hasExif).toBe(false);
  expect(info.hasMarker).toBe(false);

  // 写真を外して保存すると写真が消える
  await page.getByRole("link", { name: /写真つきの料理/ }).click();
  await page.getByRole("button", { name: "写真を外す" }).click();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("写真つきの料理")).toBeVisible();
  expect(await countIdb(page, "yoku", "photos")).toBe(0);

  // もう一度つけて、記録ごと削除
  await page.getByRole("link", { name: /写真つきの料理/ }).click();
  await page.getByTestId("food-photo-input").setInputFiles(FIXTURE);
  await expect(page.getByText(/縮小済み/)).toBeVisible();
  await page.getByRole("button", { name: "保存する" }).click();
  expect(await countIdb(page, "yoku", "photos")).toBe(1);
  await page.getByRole("link", { name: /写真つきの料理/ }).click();
  await page.getByRole("button", { name: "この記録を削除" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText("まだ記録がありません")).toBeVisible();
  expect(await countIdb(page, "yoku", "photos")).toBe(0);
});

test("画像以外のファイルは取りこまない", async ({ page }) => {
  await startReal(page);
  await page.goto("/#/food/new");
  await page.getByTestId("food-photo-input").setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert")).toContainText("画像ファイル");
});
