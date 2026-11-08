import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { startDemo } from "./helpers";

const ROUTES = [
  "/#/",
  "/#/wellness",
  "/#/wellness/edit",
  "/#/intimacy",
  "/#/intimacy/preference/new",
  "/#/food",
  "/#/food/new",
  "/#/thanks",
  "/#/thanks/new",
  "/#/together",
  "/#/share?kind=intimacy",
  "/#/settings",
  "/#/privacy"
];

for (const scheme of ["light", "dark"] as const) {
  test(`アクセシビリティ(axe: WCAG 2.2 A/AA)— ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await startDemo(page);
    const problems: string[] = [];
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForTimeout(300);
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of res.violations)
        problems.push(`${r} ${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")} — ${v.nodes[0]?.failureSummary?.split("\n")[1] ?? ""}`);
    }
    expect(problems).toEqual([]);
  });
}

test("キーボードだけで記録できる", async ({ page }) => {
  await startDemo(page);
  await page.goto("/#/thanks/new");
  await page.getByLabel("何に感謝しているか").focus();
  await page.keyboard.type("キーボードで記録");
  // フォームの送信ボタンまで Tab で進む
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => document.activeElement?.textContent ?? "");
    if (name.trim() === "保存する") break;
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/thanks$/);
  await expect(page.getByText("キーボードで記録")).toBeVisible();
  // タブはキーボードの矢印で切り替えられる
  await page.goto("/#/intimacy");
  await page.getByRole("tab", { name: "好み" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "良かった体験" })).toHaveAttribute("aria-selected", "true");
});
