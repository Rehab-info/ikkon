// Sub-Cut の検知ロジックのテスト。実行: node tools/test_subcut.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const D = require("../subcut/detect.js");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };

t("CSV: 引用符・カンマ入り金額", () => {
  const r = D.parseCSV('"a","1,500"\r\n"b ""x""",2\n');
  assert.deepStrictEqual(r, [["a", "1,500"], ['b "x"', "2"]]);
});
t("日付の書き方", () => {
  assert.strictEqual(D.parseDate("2026/10/05"), "2026-10-05");
  assert.strictEqual(D.parseDate("2026年1月2日"), "2026-01-02");
  assert.strictEqual(D.parseDate("26/1/2"), "2026-01-02");
  assert.strictEqual(D.parseDate("２０２６／１０／０５"), "2026-10-05");
  assert.strictEqual(D.parseDate("店名"), null);
});
t("金額の書き方", () => {
  assert.strictEqual(D.parseAmount("￥1,590"), 1590);
  assert.strictEqual(D.parseAmount("-300"), -300);
  assert.strictEqual(D.parseAmount("NETFLIX"), null);
});
t("見出しのない明細(三井住友カード風)", () => {
  const tx = D.extractTransactions(D.parseCSV("山田 太郎様,1234-****-****-5678,VISA\n2026/09/03,NETFLIX.COM,1590,1,1,1590,\n2026/10/03,NETFLIX.COM,1590,1,1,1590,\n"));
  assert.strictEqual(tx.length, 2);
  assert.deepStrictEqual(tx[0], { date: "2026-09-03", desc: "NETFLIX.COM", amount: 1590 });
});
t("辞書の名寄せ", () => {
  assert.strictEqual(D.findService("APPLE.COM/BILL").id, "apple");
  assert.strictEqual(D.findService("GOOGLE *YOUTUBEPREMIUM").id, "youtube");
  assert.strictEqual(D.findService("OPENAI *CHATGPT SUBSCR").id, "chatgpt");
  assert.strictEqual(D.findService("セブン-イレブン"), null);
  assert.strictEqual(D.merchantKey("SPOTIFY P2B7C91F"), D.merchantKey("SPOTIFY X9Y8Z7"));
});

const sample = fs.readFileSync(path.join(__dirname, "../subcut/sample.csv"), "utf8");
const { subs } = D.analyzeCSV(sample);
const by = Object.fromEntries(subs.map(s => [s.serviceId || s.name, s]));

t("サンプル明細: 主なサブスクを見つける", () => {
  for (const id of ["netflix", "chatgpt", "claude", "spotify", "apple", "adobe", "prime", "youtube", "notion", "m365"]) assert.ok(by[id], id);
  assert.strictEqual(by.netflix.cycle, "monthly");
  assert.strictEqual(by.netflix.confidence, "high");
  assert.strictEqual(by.netflix.nextDate, "2026-11-03");
});
t("サンプル明細: 辞書にないジムの月会費も見つける", () => {
  assert.ok(subs.find(s => s.name.includes("ジム") && s.cycle === "monthly"));
});
t("サンプル明細: ふだんの買い物は拾わない", () => {
  for (const shop of ["セブン", "スターバックス", "ユニクロ", "ローソン", "居酒屋", "AMAZON.CO.JP"]) assert.ok(!subs.some(s => s.name.includes(shop)), shop);
});
t("サンプル明細: 電気代は固定費、止まった Notion は stale", () => {
  const power = subs.find(s => s.name.includes("東京電力"));
  assert.ok(power && power.fixed);
  assert.strictEqual(by.notion.stale, true);
  assert.strictEqual(by.netflix.stale, false);
});
t("年払い: 1年おきの請求", () => {
  const s = D.detect([{ date: "2025-04-01", desc: "SOMEAPP PRO", amount: 6000 }, { date: "2026-04-01", desc: "SOMEAPP PRO", amount: 6000 }]);
  assert.strictEqual(s[0].cycle, "yearly");
  assert.strictEqual(s[0].monthly, 500);
});
console.log(`\n${n} tests passed`);
