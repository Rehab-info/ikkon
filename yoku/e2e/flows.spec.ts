import { expect, test } from "@playwright/test";
import { countIdb, expectNoHorizontalScroll, startReal, trackExternalRequests } from "./helpers";

test.describe("スマートフォンでの4領域の操作", () => {
  test("Wellness・Intimacy・Food・Thanks を記録・編集・削除し、Together から共有文を作る", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const external = trackExternalRequests(page);
    await startReal(page);
    await expectNoHorizontalScroll(page);

    // --- Wellness ---
    await page.getByRole("link", { name: "今日の記録をつける" }).click();
    await page.getByRole("group", { name: "食欲" }).getByText("0", { exact: true }).click();
    await page.getByRole("group", { name: "気分" }).getByText("7", { exact: true }).click();
    await page.getByLabel(/睡眠時間/).fill("6.5");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("heading", { name: "Wellness", exact: true })).toBeVisible();
    await expect(page.getByText("記録しました")).toBeVisible();
    await expectNoHorizontalScroll(page);
    // 編集
    await page.getByRole("link", { name: "今日の記録を編集" }).click();
    await page.getByRole("group", { name: "ストレス" }).getByText("4", { exact: true }).click();
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("記録しました")).toBeVisible();
    expect(await countIdb(page, "yoku", "wellness")).toBe(1);

    // --- Intimacy ---
    await page.goto("/#/");
    await page.getByRole("link", { name: /Intimacy/ }).first().click();
    await page.getByRole("link", { name: "好みを追加" }).click();
    await page.getByLabel("名前").fill("ゆっくりした時間");
    await page.getByLabel("メモ").fill("PRIVATE_NOTE");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("heading", { name: "Intimacy" })).toBeVisible();
    // ぼかし表示 → タップで表示
    await page.getByRole("button", { name: "内容を表示" }).first().click();
    await page.getByRole("link", { name: /ゆっくりした時間/ }).click();
    await page.getByText("今は希望しない").click();
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("今は希望しない").first()).toBeVisible();
    await page.getByRole("tab", { name: "境界線" }).click();
    await page.getByRole("link", { name: "希望や境界線を追加" }).click();
    await page.getByLabel("内容").fill("撮影はしない");
    await page.getByText("これは希望しない").click();
    await page.getByRole("button", { name: "保存する" }).click();
    expect(await countIdb(page, "yoku", "intimacyBoundaries")).toBe(1);
    await page.getByRole("tab", { name: "良かった体験" }).click();
    await page.getByRole("link", { name: "良かった体験を残す" }).click();
    await page.getByLabel("タイトル").fill("雨の日");
    await page.getByRole("button", { name: "保存する" }).click();
    expect(await countIdb(page, "yoku", "intimacyMemories")).toBe(1);
    await expectNoHorizontalScroll(page);

    // --- Food ---
    await page.getByRole("link", { name: "Food" }).click();
    await page.getByRole("link", { name: "記録する", exact: true }).click();
    await page.getByLabel("料理名").fill("トマトのパスタ");
    await page.getByLabel("ジャンル").selectOption("italian");
    await page.getByLabel("お店の名前").fill("ソーレ");
    await page.getByLabel("誰と食べたか").fill("PRIVATE_WHO");
    await page.getByLabel("また食べたい").check();
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("トマトのパスタ")).toBeVisible();
    // 検索・フィルター
    await page.getByPlaceholder("料理・お店・メモを検索").fill("カレー");
    await expect(page.getByText("条件に合う記録がありません")).toBeVisible();
    await page.getByPlaceholder("料理・お店・メモを検索").fill("ソーレ");
    await expect(page.getByText("トマトのパスタ")).toBeVisible();
    await page.getByRole("button", { name: "お気に入り", exact: true }).click();
    await expect(page.getByText("条件に合う記録がありません")).toBeVisible();
    await page.getByRole("button", { name: "また食べたい", exact: true }).click();
    await expect(page.getByText("トマトのパスタ")).toBeVisible();
    await expectNoHorizontalScroll(page);

    // --- Thanks ---
    await page.getByRole("link", { name: "Thanks" }).click();
    await page.getByRole("link", { name: "話を聞いてくれてありがとう" }).click();
    await page.getByLabel("そのときの気持ち").fill("PRIVATE_FEELING");
    await page.getByRole("button", { name: "保存して、伝える文を作る" }).click();
    await page.getByRole("button", { name: "下書きを作る" }).click();
    await page.getByRole("button", { name: "プレビューへ" }).click();
    await expect(page.getByTestId("share-preview")).toHaveText("話を聞いてくれてありがとう。");
    await page.getByRole("button", { name: "文章をコピー" }).click();
    await expect(page.getByText(/文章をコピーしました/)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("話を聞いてくれてありがとう。");

    // --- Together → Intimacy の共有 ---
    await page.getByRole("link", { name: "Together" }).click();
    await page.getByRole("link", { name: /好みについて話す/ }).click();
    await page.getByRole("checkbox", { name: /ゆっくりした時間/ }).check();
    await page.getByRole("button", { name: "下書きを作る" }).click();
    await page.getByRole("button", { name: "プレビューへ" }).click();
    const preview = page.getByTestId("share-preview");
    await expect(preview).toContainText("【今は希望しない】");
    await expect(preview).toContainText("ゆっくりした時間");
    await expect(preview).not.toContainText("PRIVATE_NOTE");
    await expect(page.getByRole("button", { name: "文章をコピー" })).toBeDisabled();
    await page.getByLabel("内容と送り先を確認しました").check();
    await page.getByRole("button", { name: "文章をコピー" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    for (const secret of ["PRIVATE_NOTE", "PRIVATE_WHO", "PRIVATE_FEELING", "撮影はしない", "雨の日"]) expect(copied).not.toContain(secret);

    // --- Food の共有 ---
    await page.goto("/#/share?kind=food");
    await page.getByRole("checkbox", { name: /トマトのパスタ/ }).check();
    await page.getByRole("button", { name: "下書きを作る" }).click();
    await expect(page.getByLabel("送る文章")).toHaveValue("この前食べたソーレのトマトのパスタがすごく美味しかった。また一緒に行きたい！");

    // --- 削除 ---
    await page.goto("/#/food");
    await page.getByRole("link", { name: /トマトのパスタ/ }).click();
    await page.getByRole("button", { name: "この記録を削除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("まだ記録がありません")).toBeVisible();
    expect(await countIdb(page, "yoku", "foods")).toBe(0);

    await page.goto("/#/wellness");
    await page.getByRole("button", { name: /の記録を削除/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("削除しました")).toBeVisible();
    expect(await countIdb(page, "yoku", "wellness")).toBe(0);

    expect(external).toEqual([]);
  });

  test("Intimacy を非表示にしてもデータは消えず、再表示で戻る", async ({ page }) => {
    await startReal(page);
    await page.goto("/#/intimacy/preference/new");
    await page.getByLabel("名前").fill("残るはずの好み");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("heading", { name: "Intimacy" })).toBeVisible();
    await page.goto("/#/settings");
    await page.getByRole("switch", { name: "Intimacy を表示" }).click();
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "記録する" })).toBeVisible();
    await expect(page.getByText("Intimacy")).toHaveCount(0);
    await page.goto("/#/intimacy");
    await expect(page).toHaveURL(/#\/$/);
    expect(await countIdb(page, "yoku", "intimacyPreferences")).toBe(1);
    await page.goto("/#/settings");
    await page.getByRole("switch", { name: "Intimacy を表示" }).click();
    await page.goto("/#/intimacy");
    await expect(page.getByRole("heading", { name: "Intimacy" })).toBeVisible();
  });

  test("全データ削除で実データ・デモデータ・写真・設定が消える", async ({ page }) => {
    await startReal(page);
    await page.goto("/#/thanks/new");
    await page.getByLabel("何に感謝しているか").fill("消える感謝");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page).toHaveURL(/#\/thanks$/);
    await page.goto("/#/settings");
    await page.getByRole("button", { name: "すべての記録を削除" }).click();
    await page.getByLabel(/「削除」と入力/).fill("削除");
    await page.getByRole("button", { name: "完全に削除する" }).click();
    await expect(page.getByRole("button", { name: "はじめる" })).toBeVisible();
    expect(await countIdb(page, "yoku", "gratitude")).toBe(0);
    const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(names).not.toContain("yoku-demo");
  });
});
