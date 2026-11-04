// Sub-Cut: カード明細(CSV)を読み、毎月・毎年くり返す引き落としを見つける。
// 画面に依存しないので、node からも読み込んでテストできる(tools/test_subcut.js)。
(function (root) {
  const S = root.SubCutServices || (typeof require !== "undefined" ? require("./services.js") : null);

  // ---------- CSV ----------
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, "");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === "," || c === "\t") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ""));
  }

  // ---------- 値の読み取り ----------
  function parseDate(s) {
    s = String(s || "").normalize("NFKC").trim();
    let m = s.match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?/);
    if (!m) { m = s.match(/^(\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); if (m) m[1] = "20" + m[1]; }
    if (!m) { m = s.match(/^(\d{4})(\d{2})(\d{2})$/); }
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function parseAmount(s) {
    s = String(s || "").normalize("NFKC").replace(/[¥￥円,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Math.round(parseFloat(s));
  }

  const H_DATE = /利用日|ご利用日|日付|取引日|DATE/i;
  const H_DESC = /利用店|ご利用先|利用先|店名|内容|摘要|明細|加盟店|DESCRIPTION|MERCHANT|NAME/i;
  const H_AMT = /利用金額|ご利用金額|金額|支払金額|AMOUNT/i;

  // 明細の行 → { date, desc, amount }。見出しがあれば見出しで、なければ中身から列を推し量る
  function extractTransactions(rows) {
    let cols = null, start = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i];
      const d = r.findIndex(c => H_DATE.test(c)), n = r.findIndex(c => H_DESC.test(c) && !H_DATE.test(c)), a = r.findIndex(c => H_AMT.test(c));
      if (d >= 0 && n >= 0 && a >= 0) { cols = { d, n, a }; start = i + 1; break; }
    }
    const out = [];
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      let date, desc, amount;
      if (cols) { date = parseDate(r[cols.d]); desc = r[cols.n]; amount = parseAmount(r[cols.a]); }
      else {
        const di = r.findIndex(c => parseDate(c)); if (di < 0) continue;
        date = parseDate(r[di]);
        // 日付のあと、数字でない最初の列を店名、そのあとの最初の数字を金額とみなす
        const ni = r.findIndex((c, j) => j > di && c && parseAmount(c) === null && !parseDate(c));
        if (ni < 0) continue;
        desc = r[ni];
        const ai = r.findIndex((c, j) => j > ni && parseAmount(c) !== null);
        amount = ai >= 0 ? parseAmount(r[ai]) : null;
      }
      if (!date || !desc || amount === null || amount <= 0) continue; // 返金・見出しの残りは除く
      out.push({ date, desc, amount });
    }
    return out;
  }

  // ---------- 名寄せ ----------
  function normalize(desc) {
    return String(desc).normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
  }
  function findService(desc) {
    const n = normalize(desc);
    return S.SERVICES.find(s => s.match.test(n)) || null;
  }
  // 辞書にない店は、注文番号などの数字や記号を落とした先頭の語でまとめる
  function merchantKey(desc) {
    const svc = findService(desc);
    if (svc) return "svc:" + svc.id;
    const words = normalize(desc).replace(/[*#\/\\_.:;()\[\]「」・-]/g, " ").replace(/\b\w*\d\w*\b/g, " ")
      .replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    return "raw:" + (words.slice(0, 3).join(" ") || normalize(desc));
  }

  // ---------- くり返しの判定 ----------
  const DAY = 86400000;
  const toTime = d => Date.parse(d + "T00:00:00Z");
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function cycleFromGaps(gaps) {
    if (!gaps.length) return null;
    const g = median(gaps);
    if (g >= 5 && g <= 9) return "weekly";
    if (g >= 25 && g <= 35) return "monthly";
    if (g >= 80 && g <= 100) return "quarterly";
    if (g >= 350 && g <= 380) return "yearly";
    return null;
  }
  const PER_MONTH = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  const STEP_DAYS = { weekly: 7, monthly: 30.44, quarterly: 91.3, yearly: 365.25 };

  function addCycle(date, cycle) {
    const t = new Date(toTime(date));
    if (cycle === "weekly") t.setUTCDate(t.getUTCDate() + 7);
    else if (cycle === "monthly") t.setUTCMonth(t.getUTCMonth() + 1);
    else if (cycle === "quarterly") t.setUTCMonth(t.getUTCMonth() + 3);
    else t.setUTCFullYear(t.getUTCFullYear() + 1);
    return t.toISOString().slice(0, 10);
  }

  // transactions → サブスクの候補一覧
  function detect(transactions, opts = {}) {
    const groups = new Map();
    for (const t of transactions) {
      const k = merchantKey(t.desc);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const latestDate = transactions.reduce((m, t) => (t.date > m ? t.date : m), "0000-00-00");
    const subs = [];
    for (const [key, list] of groups) {
      list.sort((a, b) => a.date.localeCompare(b.date));
      // 同じ日の重複(取り込みの二重など)は1件にする
      const charges = list.filter((t, i) => !(i && t.date === list[i - 1].date && t.amount === list[i - 1].amount));
      const svc = key.startsWith("svc:") ? S.SERVICES.find(s => "svc:" + s.id === key) : null;
      const amounts = charges.map(c => c.amount);
      const med = median(amounts);
      // 金額がそろっている引き落としだけでくり返しを判断する(ふだんの買い物を拾わないため)
      // 辞書にない店は金額がほぼ同じものだけ。電気・ガスなどの固定費は金額が月ごとに変わるので全件を使う
      const fixedKey = S.FIXED.test(normalize(list[0].desc));
      const tol = svc ? 0.15 : fixedKey ? Infinity : 0.03;
      const steady = charges.filter(c => Math.abs(c.amount - med) <= Math.max(med * tol, svc ? 50 : 0));
      const gaps = steady.slice(1).map((c, i) => (toTime(c.date) - toTime(steady[i].date)) / DAY);
      let cycle = cycleFromGaps(gaps);
      let confidence;
      if (svc) {
        // 辞書にあるサービスは、1回だけでも候補に出す
        confidence = steady.length >= 2 && cycle ? "high" : "medium";
        cycle = cycle || svc.cycle;
      } else {
        const months = new Set(steady.map(c => c.date.slice(0, 7)));
        if (!cycle || steady.length < 2 || (cycle !== "yearly" && months.size < 2)) continue;
        // 同じ店で金額がばらばらの買い物が多いなら、たまたまそろっただけとみなす
        if (steady.length / charges.length < 0.6) continue;
        // 2回だけの月払いは、引き落とし日がほぼ同じときだけ認める
        if (cycle === "monthly" && steady.length === 2) {
          const d1 = +steady[0].date.slice(8), d2 = +steady[1].date.slice(8);
          if (Math.abs(d1 - d2) > 3) continue;
        }
        // 間隔がばらつくもの(たまに行く店)は除く
        const spread = gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 0;
        if (spread > { weekly: 3, monthly: 12, quarterly: 20, yearly: 25 }[cycle]) continue;
        confidence = steady.length >= 3 ? "high" : "medium";
      }
      const last = (steady.length ? steady : charges).at(-1);
      const name = svc ? svc.name : prettyName(last.desc);
      const fixed = S.FIXED.test(normalize(last.desc));
      // 最後の請求から2周期以上あいていれば、もう止まっている可能性が高い
      const stale = (toTime(latestDate) - toTime(last.date)) / DAY > STEP_DAYS[cycle] * 1.8;
      subs.push({
        id: key, name, serviceId: svc ? svc.id : null, category: svc ? svc.cat : fixed ? "固定費" : "その他",
        amount: last.amount, cycle, monthly: Math.round(last.amount * PER_MONTH[cycle]),
        lastDate: last.date, nextDate: addCycle(last.date, cycle), count: charges.length,
        confidence, fixed, stale, rawDesc: last.desc,
        charges: charges.map(c => ({ date: c.date, amount: c.amount }))
      });
    }
    subs.sort((a, b) => b.monthly - a.monthly);
    return subs;
  }

  function prettyName(desc) {
    const s = String(desc).normalize("NFKC").replace(/\s+/g, " ").trim();
    return s.length > 28 ? s.slice(0, 28) + "…" : s;
  }

  function analyzeCSV(text) {
    const tx = extractTransactions(parseCSV(text));
    return { transactions: tx, subs: detect(tx) };
  }

  const api = { parseCSV, parseDate, parseAmount, extractTransactions, normalize, findService, merchantKey, detect, analyzeCSV, addCycle, PER_MONTH };
  root.SubCutDetect = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
