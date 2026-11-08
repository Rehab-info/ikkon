import { expect, test } from "@playwright/test";
import { ORIGIN, startDemo } from "./helpers";

test("外部通信の監査:全画面を操作しても、同じオリジン以外へのリクエストが発生しない", async ({ page, context }) => {
  const all: string[] = [];
  context.on("request", (r) => all.push(r.url()));
  const sockets: string[] = [];
  page.on("websocket", (ws) => sockets.push(ws.url()));

  await startDemo(page);
  const routes = [
    "/#/",
    "/#/wellness",
    "/#/wellness/edit",
    "/#/intimacy",
    "/#/intimacy?tab=memories",
    "/#/intimacy?tab=boundaries",
    "/#/intimacy/preference/new",
    "/#/food",
    "/#/food/new",
    "/#/thanks",
    "/#/thanks/new",
    "/#/together",
    "/#/share?kind=feeling",
    "/#/share?kind=intimacy",
    "/#/share?kind=food",
    "/#/share?kind=thanks",
    "/#/share?kind=topic&topic=t1",
    "/#/settings",
    "/#/privacy"
  ];
  for (const r of routes) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
  }
  // 記録の保存と共有文の作成
  await page.goto("/#/thanks/new");
  await page.getByLabel("何に感謝しているか").fill("監査用の記録");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/#\/thanks$/);
  await page.goto("/#/share?kind=feeling");
  await page.getByRole("checkbox", { name: "今日は元気です" }).check();
  await page.getByRole("button", { name: "下書きを作る" }).click();
  await page.getByRole("button", { name: "プレビューへ" }).click();
  await page.waitForLoadState("networkidle");

  const external = all.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith("blob:") && !u.startsWith("data:"));
  expect(external).toEqual([]);
  expect(sockets).toEqual([]);
  // 同じオリジンへのリクエストも、アプリの静的ファイルの取得だけ(記録の送信がない)
  const nonGet = all.filter((u) => u.startsWith(ORIGIN) && /\/api\/|collect|track|analytics/.test(u));
  expect(nonGet).toEqual([]);
});

test("CSP で外部への接続をブラウザーが拒否する", async ({ page }) => {
  await page.goto("/");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("script-src 'self'");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://example.com/collect", { method: "POST", body: "x" });
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});
