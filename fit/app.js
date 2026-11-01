/* FIT NOTE — インボディのデータ × 年齢・性別・好み × 今季の流行 → コーデ提案
   すべてブラウザ内で処理する(データは送信しない)。 */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; };
  const r1 = (n) => Math.round(n * 10) / 10;

  const state = { step: 1, rows: [], body: {}, trends: null, catalog: [], season: null };

  /* ---------------------------------------------------------------
     1. データ読み込み
     --------------------------------------------------------------- */
  Promise.all([
    fetch("data/trends.json").then((r) => r.json()),
    fetch("data/catalog.json").then((r) => r.json()),
  ]).then(([trends, catalog]) => {
    state.trends = trends;
    state.catalog = catalog.items;
    state.season = pickSeason(trends.seasons, new Date());
    $("#seasonBadge").textContent = state.season.label + " のトレンド";
    $("#sourceList").innerHTML = "流行の参考: " + state.season.sources
      .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" / ");
  }).catch(() => {
    $("#loadMsg").textContent = "データを読み込めませんでした。サーバー経由で開いてください(README 参照)。";
    $("#loadMsg").className = "note err";
  });

  function pickSeason(seasons, date) {
    const ym = date.toISOString().slice(0, 7);
    const hit = seasons.find((s) => s.period[0] <= ym && ym <= s.period[1]);
    if (hit) return { ...hit, stale: false };
    // 該当がなければ一番新しい季節を使い、古いことを知らせる
    const latest = [...seasons].sort((a, b) => b.period[1].localeCompare(a.period[1]))[0];
    return { ...latest, stale: true };
  }
  const currentSeasonKind = () => {
    const m = new Date().getMonth() + 1;
    return m >= 9 || m <= 2 ? "aw" : "ss";
  };

  /* ---------------------------------------------------------------
     2. インボディ CSV の解析
     LookinBody などの書き出し(横持ち: 1行目が見出し)と、
     「項目,値」の縦持ちの両方に対応。Shift_JIS も自動判別。
     --------------------------------------------------------------- */
  const FIELD_ALIASES = {
    date: ["測定日", "測定日時", "日付", "date", "datetime", "testdate", "testdatetime", "検査日"],
    gender: ["性別", "gender", "sex"],
    age: ["年齢", "age"],
    height: ["身長", "height", "ht"],
    weight: ["体重", "weight", "wt"],
    pbf: ["体脂肪率", "pbf", "percentbodyfat", "bodyfatpercentage", "bodyfat%"],
    bfm: ["体脂肪量", "bfm", "bodyfatmass"],
    smm: ["骨格筋量", "smm", "skeletalmusclemass"],
    bmi: ["bmi", "bodymassindex"],
    whr: ["ウエストヒップ比", "ウェストヒップ比", "whr", "waisthipratio", "waist-hipratio"],
    vfl: ["内臓脂肪レベル", "vfl", "visceralfatlevel"],
  };
  const PARTS = [
    ["ra", /右腕|rightarm|arm\(right\)|ra$/],
    ["la", /左腕|leftarm|arm\(left\)|la$/],
    ["tr", /体幹|trunk/],
    ["rl", /右脚|右足|rightleg|leg\(right\)|rl$/],
    ["ll", /左脚|左足|leftleg|leg\(left\)|ll$/],
  ];

  function normHeader(h) {
    return String(h).replace(/^﻿/, "").trim().toLowerCase()
      .replace(/[（(][^）)]*(kg|cm|%|l|ｋｇ|ｃｍ|％|m²|m2|点|lv)[^）)]*[）)]/gi, "")
      .replace(/\s|_|・|:|：/g, "");
  }

  // 見出し1つを、内部のキー(height など)に読み替える
  function classify(rawHeader) {
    const raw = String(rawHeader);
    const h = normHeader(raw);
    if (!h) return null;
    // 部位別(評価・%表記は除外)
    if (!/%|％|評価|ratio|evaluation|割合/.test(raw)) {
      for (const [key, re] of PARTS) {
        if (re.test(h) && h.length > 2) {
          if (/除脂肪|筋肉|lean|muscle|lbm/.test(h)) return "lean_" + key;
          if (/脂肪|fat/.test(h)) return "fat_" + key;
        }
      }
    }
    for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(h)) return key;
    }
    return null;
  }

  function parseCSV(text) {
    const sep = text.split("\n")[0].includes("\t") ? "\t" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some((x) => x.trim() !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    return rows;
  }

  function decode(buf) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { return new TextDecoder("shift_jis").decode(buf); }
  }

  // テキスト → 測定記録の配列 [{height, weight, ...}]
  function toRecords(text) {
    text = text.replace(/^﻿/, "");
    if (/^\s*[\[{]/.test(text)) {
      const j = JSON.parse(text);
      return (Array.isArray(j) ? j : [j]).map((o) => mapObject(Object.entries(o)));
    }
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const headerKeys = rows[0].map(classify);
    const hits = headerKeys.filter(Boolean).length;
    // 縦持ち(1列目が項目名)の判定
    const verticalHits = rows.filter((r) => classify(r[0])).length;
    if (verticalHits > hits && rows[0].length <= 4) {
      return [mapObject(rows.map((r) => [r[0], r[1]]))];
    }
    if (!hits) return [];
    return rows.slice(1).map((r) => mapObject(rows[0].map((h, i) => [h, r[i]])));
  }

  function mapObject(entries) {
    const rec = {};
    for (const [h, v] of entries) {
      const key = classify(h);
      if (!key || v == null || String(v).trim() === "") continue;
      if (key === "date") rec.date = String(v).trim();
      else if (key === "gender") {
        const s = String(v).trim().toLowerCase();
        rec.gender = /女|^f|female|woman/.test(s) ? "f" : /男|^m|male|man/.test(s) ? "m" : undefined;
      } else {
        const n = num(v);
        if (n != null && !(key in rec)) rec[key] = n;
      }
    }
    // 身長が m で入っている場合
    if (rec.height && rec.height < 3) rec.height *= 100;
    if (rec.pbf == null && rec.bfm && rec.weight) rec.pbf = r1((rec.bfm / rec.weight) * 100);
    return rec;
  }

  function sortByDate(recs) {
    const t = (r) => { const d = Date.parse(String(r.date || "").replace(/\./g, "/").replace(/年|月/g, "/").replace(/日/, "")); return Number.isFinite(d) ? d : 0; };
    return recs.map((r, i) => ({ r, i, t: t(r) })).sort((a, b) => (a.t - b.t) || (a.i - b.i)).map((x) => x.r);
  }

  async function handleFile(file) {
    const msg = $("#loadMsg");
    try {
      const text = decode(await file.arrayBuffer());
      loadRecords(toRecords(text), file.name);
    } catch (e) {
      msg.textContent = "ファイルを読み取れませんでした。CSV か JSON で書き出したものを選んでください。";
      msg.className = "note err";
    }
  }

  function loadRecords(recs, label) {
    const msg = $("#loadMsg");
    recs = sortByDate(recs.filter((r) => r.height || r.weight));
    if (!recs.length) {
      msg.textContent = "身長・体重などの項目が見つかりませんでした。下の欄に手で入力できます。";
      msg.className = "note err";
      showForm();
      return;
    }
    state.rows = recs;
    const sel = $("#rowSelect");
    sel.innerHTML = recs.map((r, i) => `<option value="${i}">${esc(r.date || `記録 ${i + 1}`)}</option>`).join("");
    sel.value = String(recs.length - 1);
    $("#rowSelectWrap").hidden = recs.length < 2;
    applyRecord(recs[recs.length - 1]);
    const count = Object.keys(recs[recs.length - 1]).filter((k) => !["date", "gender", "age"].includes(k)).length;
    msg.textContent = `「${label}」から ${count} 項目を読み取りました${recs.length > 1 ? `(${recs.length} 回分の測定のうち最新)` : ""}。数値を確かめて「次へ」。`;
    msg.className = "note ok";
  }

  function applyRecord(rec) {
    showForm();
    const form = $("#bodyForm");
    $$("input", form).forEach((inp) => {
      const v = rec[inp.name];
      inp.value = v != null ? v : "";
      inp.closest(".field").classList.toggle("filled", v != null);
    });
    if (["lean_ra", "fat_ra"].some((k) => rec[k] != null)) $("#segDetails").open = true;
    if (rec.age) $("#age").value = Math.round(rec.age);
    if (rec.gender) setSingle($("#genderChips"), rec.gender);
  }

  function showForm() { $("#bodyForm").hidden = false; }

  function readBody() {
    const b = {};
    $$("#bodyForm input").forEach((inp) => { const n = num(inp.value); if (n != null) b[inp.name] = n; });
    return b;
  }

  const dz = $("#dropzone");
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("over"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  $("#fileInput").addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  $("#rowSelect").addEventListener("change", (e) => applyRecord(state.rows[+e.target.value]));
  $("#manualBtn").addEventListener("click", () => { showForm(); $("#bodyForm input").focus(); });
  $("#sampleBtn").addEventListener("click", async () => {
    const text = decode(await (await fetch("sample/inbody-sample.csv")).arrayBuffer());
    loadRecords(toRecords(text), "サンプル");
  });
  $("#bodyForm").addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("filled"));

  /* ---------------------------------------------------------------
     3. 画面の切り替え・チップ
     --------------------------------------------------------------- */
  function setSingle(group, v) {
    $$(".chip", group).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === v)));
  }
  function getChips(group) { return $$('.chip[aria-pressed="true"]', group).map((c) => c.dataset.v); }

  $$(".chips").forEach((group) => {
    $$(".chip", group).forEach((c) => c.setAttribute("aria-pressed", "false"));
    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      if (group.classList.contains("single")) return setSingle(group, chip.dataset.v);
      const on = chip.getAttribute("aria-pressed") === "true";
      const max = +group.dataset.max || Infinity;
      if (!on && getChips(group).length >= max) {
        group.classList.remove("shake"); void group.offsetWidth; group.classList.add("shake");
        return;
      }
      chip.setAttribute("aria-pressed", String(!on));
    });
  });
  // 初期値
  setSingle($("#genderChips"), "x");
  setSingle($("#colorChips"), "any");
  $$('#occChips .chip[data-v="off"], #occChips .chip[data-v="work"]').forEach((c) => c.setAttribute("aria-pressed", "true"));

  $$("[data-age]").forEach((b) => b.addEventListener("click", () => {
    const a = $("#age"); a.value = Math.min(99, Math.max(10, (num(a.value) || 30) + +b.dataset.age));
  }));

  function validate(step) {
    if (step === 1) {
      const b = readBody();
      if (!b.height || !b.weight) {
        showForm();
        $("#loadMsg").textContent = "身長と体重は必ず入れてください。";
        $("#loadMsg").className = "note err";
        $(`#bodyForm input[name="${!b.height ? "height" : "weight"}"]`).focus();
        return false;
      }
      if (b.height < 100 || b.height > 230 || b.weight < 25 || b.weight > 250) {
        $("#loadMsg").textContent = "身長(cm)・体重(kg)の値を確かめてください。";
        $("#loadMsg").className = "note err";
        return false;
      }
    }
    if (step === 2) {
      const a = num($("#age").value);
      if (!a || a < 10 || a > 99) { $("#age").focus(); return false; }
    }
    return true;
  }

  let maxReached = 1;
  function go(step) {
    if (step > state.step) {
      for (let s = state.step; s < step; s++) if (!validate(s)) return;
    }
    if (step === 4) render();
    state.step = step;
    maxReached = Math.max(maxReached, step);
    $$(".panel").forEach((p) => (p.hidden = +p.dataset.step !== step));
    $$("#steps li").forEach((li, i) => {
      li.classList.toggle("active", i + 1 === step);
      li.classList.toggle("done", i + 1 < step);
      $("button", li).disabled = i + 1 > maxReached && i + 1 !== step + 1;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-next],[data-prev],[data-goto]");
    if (!t) return;
    if (t.matches("[data-next]")) go(state.step + 1);
    else if (t.matches("[data-prev]")) go(state.step - 1);
    else go(+t.dataset.goto);
  });
  $("#goResult").addEventListener("click", () => go(4));
  $("#printBtn").addEventListener("click", () => window.print());
  $("#restartBtn").addEventListener("click", () => location.reload());
  go(1);

  /* ---------------------------------------------------------------
     4. 体型の分析
     --------------------------------------------------------------- */
  const SHAPES = {
    Y: { name: "逆三角タイプ", line: "Yライン", sub: "肩・胸まわりにボリュームがあり、下半身はすっきり",
      aim: "下半身にボリュームを足し、上半身はすっきり見せて上下のバランスを整えます。",
      do: ["Vネックや前開きで首元に抜けをつくる", "ワイド・ストレート・カーゴなど下半身に存在感のあるボトム", "上は濃い色、下は明るい色で重心を下げる", "肩が自然に落ちる柔らかい素材"],
      dont: ["肩パッド・パフ袖・ケープなど肩を強調するデザイン", "上半身のもこもこ素材や厚手ニット", "細すぎるスキニーだけのコーデ"] },
    A: { name: "下重心タイプ", line: "Aライン", sub: "腰まわりや脚にボリュームがあり、上半身は華奢",
      aim: "視線を上半身に集め、腰まわりは落ち感のある服でさらりと流します。",
      do: ["ショート丈アウターやハイウエストで重心を上げる", "襟・装飾・明るい色で顔まわりを華やかに", "落ち感のあるワイドパンツやAラインスカート", "上は明るい色、下は濃い色で引き締める"],
      dont: ["腰がちょうど隠れる中途半端な丈のトップス", "脚に貼りつく細身のボトム", "太畝コーデュロイなど厚手で膨らむボトム"] },
    O: { name: "中心ボリュームタイプ", line: "Iライン(縦長)", sub: "おなか・ウエストまわりにボリュームが集まりやすい",
      aim: "縦のラインを強調し、おなかまわりは布を沿わせすぎずに落とします。",
      do: ["Vネック・前開きのアウターで縦長のIライン", "センタープレスやテーパードなど縦の線が通るボトム", "とろみ・落ち感のある素材", "アウターとボトムを同系の濃い色でつなげる"],
      dont: ["ウエストをベルトで強く締める", "短い丈のトップスや体に沿うニット", "厚手で膨張して見える素材を胴まわりに"] },
    I: { name: "ストレート細身タイプ", line: "立体感プラス", sub: "体の厚みが少なく、すらりとした直線的な体型",
      aim: "素材の厚みや重ね着で立体感を足し、華奢さを魅力に変えます。",
      do: ["ローゲージニットやシャギーなど立体感のある素材", "重ね着・レイヤードで厚みを出す", "ワイド・カーゴなどボリュームのあるボトム", "ハリのある素材のアウター"],
      dont: ["薄手で体に貼りつく素材だけのコーデ", "大きすぎて体が泳ぐサイズ"] },
    X: { name: "くびれタイプ", line: "Xライン", sub: "肩と腰のバランスがよく、ウエストに自然なくびれ",
      aim: "ウエストの位置をはっきり見せると、体のラインがいちばんきれいに映えます。",
      do: ["ベルトやラップデザインでウエストマーク", "ハイウエストのボトム", "体に程よく沿うジャストサイズ", "Iラインのワンピースやタイトスカート"],
      dont: ["くびれを隠すボックスシルエットだけのコーデ", "全身オーバーサイズ"] },
    H: { name: "バランスタイプ", line: "I / Aライン", sub: "上下の差が少なく、標準的なバランス",
      aim: "ほとんどの形が似合います。サイズ感を整え、視線を集める場所を1つ決めると垢抜けます。",
      do: ["ジャストサイズを基本に、どこか1点にボリューム", "Iライン・Aラインのどちらも得意", "ベルトや色の切り替えで腰の位置を高めに"],
      dont: ["全身オーバーサイズで輪郭がぼやける", "装飾を上下に盛りすぎる"] },
  };

  function analyze(b, gender, age) {
    const g = gender === "x" ? null : gender;
    const h = b.height / 100;
    const bmi = b.bmi || b.weight / (h * h);
    const pbf = b.pbf;
    const smi = b.smm ? b.smm / (h * h) : null;            // 骨格筋量 ÷ 身長²
    const std = {
      pbf: g === "m" ? [10, 20] : g === "f" ? [18, 28] : [14, 24],
      smi: g === "m" ? [10.0, 11.5] : g === "f" ? [7.6, 8.8] : [8.8, 10.2],
      whr: g === "m" ? [0.80, 0.90] : g === "f" ? [0.75, 0.85] : [0.78, 0.88],
      tall: g === "m" ? [165, 180] : g === "f" ? [153, 167] : [158, 174],
    };
    const lean = ["ra", "la", "tr", "rl", "ll"].map((k) => b["lean_" + k]);
    const fat = ["ra", "la", "tr", "rl", "ll"].map((k) => b["fat_" + k]);
    const hasLean = lean.every((v) => v > 0);
    const hasFat = fat.every((v) => v >= 0 && v != null);
    const upperRatio = hasLean ? (lean[0] + lean[1] + lean[2]) / (lean[3] + lean[4]) : null; // 標準 ≈ 1.7〜1.8
    const legFatShare = hasFat ? (fat[3] + fat[4]) / fat.reduce((a, c) => a + c, 0) : null;    // 標準 ≈ 0.33〜0.37

    const lvl = (v, [lo, hi]) => (v == null ? null : v < lo ? "low" : v > hi ? "high" : "std");
    const fatLv = lvl(pbf, std.pbf);
    const musLv = lvl(smi, std.smi);
    const whrLv = lvl(b.whr, std.whr);
    const heightLv = b.height < std.tall[0] ? "small" : b.height >= std.tall[1] ? "tall" : "std";

    const reasons = [];
    let shape;
    const legFatHigh = legFatShare != null && legFatShare > (g === "m" ? 0.38 : 0.41);
    if ((b.whr && b.whr > std.whr[1] + 0.05) || (b.vfl >= 10) || (fatLv === "high" && bmi >= 25)) {
      shape = "O";
      if (b.whr) reasons.push(`ウエストヒップ比 ${b.whr} は標準(${std.whr.join("〜")})より高め`);
      if (b.vfl >= 10) reasons.push(`内臓脂肪レベル ${b.vfl}`);
      if (fatLv === "high" && bmi >= 25) reasons.push(`BMI ${r1(bmi)}・体脂肪率 ${pbf}%`);
    } else if ((upperRatio && upperRatio > 1.92) || (musLv === "high" && upperRatio && upperRatio > 1.82)) {
      shape = "Y"; reasons.push(`上半身の筋肉量が脚の ${r1(upperRatio)} 倍(標準は 1.7〜1.8 倍)`);
    } else if ((upperRatio && upperRatio < 1.58) || legFatHigh) {
      shape = "A";
      if (upperRatio && upperRatio < 1.58) reasons.push(`脚の筋肉量の比率が高め(上半身 ÷ 脚 = ${r1(upperRatio)})`);
      if (legFatHigh) reasons.push(`体脂肪の ${Math.round(legFatShare * 100)}% が脚に集中`);
    } else if (bmi < 19.5 && fatLv !== "high") {
      shape = "I"; reasons.push(`BMI ${r1(bmi)} で体の厚みが少なめ`);
    } else if (b.whr && b.whr <= std.whr[0] + 0.03 && fatLv !== "high") {
      shape = "X"; reasons.push(`ウエストヒップ比 ${b.whr} でくびれがはっきり`);
    } else {
      shape = "H"; reasons.push("上下の筋肉・脂肪のつき方が標準的");
    }

    // 骨格タイプ(ストレート/ウェーブ/ナチュラル)の参考推定
    const sc = { straight: 0, wave: 0, natural: 0 };
    if (musLv === "high") sc.straight += 2; if (musLv === "low") sc.wave += 2;
    if (upperRatio > 1.82) sc.straight += 1.5; if (upperRatio && upperRatio < 1.65) sc.wave += 1.5;
    if (legFatHigh) sc.wave += 1;
    if (heightLv === "tall") sc.natural += 1.5; if (heightLv === "small") sc.wave += 0.5;
    if (bmi < 21 && fatLv !== "high" && musLv !== "high") sc.natural += 1;
    if (fatLv === "low") sc.natural += 1;
    if (b.whr && whrLv === "low") sc.wave += 0.5;
    const best = Object.entries(sc).sort((a, b2) => b2[1] - a[1]);
    const skeleton = best[0][1] >= 1.5 && best[0][1] - best[1][1] >= 0.5
      ? { straight: "ストレート", wave: "ウェーブ", natural: "ナチュラル" }[best[0][0]] : null;

    return { shape, bmi, pbf, smi, upperRatio, legFatShare, fatLv, musLv, whrLv, heightLv, std, reasons, skeleton, hasLean, age };
  }

  /* ---------------------------------------------------------------
     5. コーデの組み立て
     --------------------------------------------------------------- */
  const OCC = { work: "仕事", off: "休日", date: "デート・食事", formal: "式・きちんとした場" };
  const CAT = { outer: "アウター", tops: "トップス", bottoms: "ボトム", onepiece: "ワンピース", shoes: "靴", acc: "小物" };
  const PALETTES = {
    mono: [["ブラック", "#1f1f1f"], ["オフホワイト", "#f4f4f2"], ["チャコール", "#4a4a4a"], ["ライトグレー", "#c9c9c9"]],
    earth: [["ブラウン", "#6b4a32"], ["ベージュ", "#d8c3a5"], ["カーキ", "#6b6a3a"], ["アイボリー", "#efe8da"]],
    navy: [["ネイビー", "#1f2d4d"], ["サックスブルー", "#a9c3dc"], ["オフホワイト", "#f4f4f2"], ["グレー", "#8a8a8a"]],
    soft: [["ラベンダー", "#c8bfe0"], ["ペールピンク", "#efcfd2"], ["ミント", "#bfdccb"], ["アイボリー", "#efe8da"]],
    vivid: [["レッド", "#c0392b"], ["コバルトブルー", "#1f4fa8"], ["イエロー", "#e8c22e"], ["ブラック", "#1f1f1f"]],
  };
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  function eligible(item, ctx) {
    if (ctx.gender !== "x" && item.g !== "u" && item.g !== ctx.gender) return false;
    if (item.bad?.includes(ctx.shape)) return false;
    if ((item.tags || []).some((t) => ctx.avoid.includes(t))) return false;
    if (item.ageMax && ctx.age > item.ageMax) return false;
    if (item.season && item.season !== "all" && item.season !== ctx.seasonKind) return false;
    return true;
  }

  function score(item, ctx, occ) {
    let s = 0;
    const tm = item.tastes.filter((t) => ctx.tastes.includes(t)).length;
    s += ctx.tastes.length ? tm * 2.2 : 0.5;
    if (item.good.includes(ctx.shape)) s += item.good.length <= 3 ? 2.4 : 1.4; // 体型を選ぶ服ほど「似合う」価値が高い
    if (occ && item.occ.includes(occ)) s += 2.5; else if (occ) s -= 4;
    if (item.trend) s += (ctx.trendLevel - 2) * 1.1;
    if (ctx.used.has(item.id)) s -= 5;
    // 年代の調整
    if (ctx.age >= 40 && (item.tags || []).includes("oversize")) s -= 1;
    if (ctx.age >= 45 && item.tastes.includes("street")) s -= 0.6;
    if (ctx.age < 25 && item.trend) s += 0.4;
    return s;
  }

  function pickBest(pool, cat, ctx, occ) {
    const list = pool.filter((i) => i.cat === cat && eligible(i, ctx) && (!occ || i.occ.includes(occ)));
    if (!list.length) return null;
    return list.map((i) => ({ i, s: score(i, ctx, occ) })).sort((a, b) => b.s - a.s)[0];
  }

  function colorPlan(ctx, idx) {
    const trendCols = state.season.colors.map((c) => [c.name, c.hex]);
    const base = ctx.color === "any" ? [["ブラック", "#1f1f1f"], ["オフホワイト", "#f4f4f2"], ["グレー", "#8a8a8a"], ["ベージュ", "#d8c3a5"]] : PALETTES[ctx.color];
    const accent = ctx.trendLevel >= 3 || ctx.color === "any" ? trendCols[idx % trendCols.length] : base[(idx + 2) % base.length];
    const sorted = [...base].sort((a, b) => lum(a[1]) - lum(b[1]));
    const dark = sorted[0], light = sorted[sorted.length - 1], mid = sorted[1];
    // 体型ごとに明暗の置き場所を変える
    switch (ctx.shape) {
      case "Y": return { outer: mid, tops: dark, bottoms: light, onepiece: dark, shoes: dark, acc: accent };
      case "A": return { outer: light, tops: accent, bottoms: dark, onepiece: dark, shoes: dark, acc: mid };
      case "O": return { outer: dark, tops: light, bottoms: dark, onepiece: dark, shoes: dark, acc: accent };
      case "I": return { outer: accent, tops: light, bottoms: mid, onepiece: accent, shoes: dark, acc: dark };
      default: return { outer: dark, tops: light, bottoms: idx % 2 ? accent : mid, onepiece: accent, shoes: dark, acc: accent };
    }
  }

  function buildOutfits(ctx) {
    const trendItems = state.season.items.map((i) => ({ ...i, trend: true }));
    const pool = [...state.catalog, ...trendItems];
    const occs = ctx.occ.length ? ctx.occ.slice(0, 4) : ["off", "work"];
    return occs.map((occ, idx) => {
      const slots = [];
      const useOuter = ctx.seasonKind === "aw" || occ === "work" || occ === "formal";
      if (useOuter) slots.push("outer");
      const top = pickBest(pool, "tops", ctx, occ);
      const bottom = pickBest(pool, "bottoms", ctx, occ);
      const one = pickBest(pool, "onepiece", ctx, occ);
      const picks = [];
      for (const cat of slots) { const p = pickBest(pool, cat, ctx, occ); if (p) picks.push(p.i); }
      if (one && (!top || !bottom || one.s > (top.s + bottom.s) / 2 + 0.5)) picks.push(one.i);
      else { if (top) picks.push(top.i); if (bottom) picks.push(bottom.i); }
      ["shoes", "acc"].forEach((cat) => { const p = pickBest(pool, cat, ctx, occ); if (p) picks.push(p.i); });
      picks.forEach((i) => ctx.used.add(i.id));
      const colors = colorPlan(ctx, idx);
      return { occ, items: picks.map((i) => ({ ...i, color: colors[i.cat] })) };
    });
  }

  function rateTrends(ctx) {
    return state.season.items
      .filter((i) => ctx.gender === "x" || i.g === "u" || i.g === ctx.gender)
      .map((i) => {
        let grade, note;
        if (i.bad.includes(ctx.shape)) { grade = "△"; note = "体型的には難しめ。小物や部分使いで取り入れるのがおすすめ"; }
        else if (i.good.includes(ctx.shape) && i.tastes.some((t) => ctx.tastes.includes(t))) { grade = "◎"; note = i.tip; }
        else if (i.good.includes(ctx.shape)) { grade = "○"; note = i.tip; }
        else { grade = "○"; note = "サイズ感を合わせれば無理なく取り入れられる"; }
        if (i.ageMax && ctx.age > i.ageMax) { grade = "△"; note = "若い世代の流行。取り入れるなら色や素材を落ち着かせて"; }
        if ((i.tags || []).some((t) => ctx.avoid.includes(t))) { grade = "—"; note = "避けたいものに入っているので外しました"; }
        return { ...i, grade, note };
      })
      .sort((a, b) => "◎○△—".indexOf(a.grade) - "◎○△—".indexOf(b.grade));
  }

  function ageAdvice(age, heightLv, gender) {
    const out = [];
    if (age < 25) out.push("流行のアイテムを取り入れやすい年代。トレンドは手頃な価格で試し、靴とバッグは定番を。");
    else if (age < 40) out.push("定番7:流行3がちょうどいいバランス。流行は1コーデに1点が目安です。");
    else if (age < 55) out.push("素材の質とジャストサイズが一番の近道。流行は色や小物で取り入れると品よくまとまります。");
    else out.push("上質で着心地のよい素材を中心に。顔まわりに明るい色を置くと表情が華やぎます。");
    if (heightLv === "small") out.push("小柄さんは同系色でまとめる・ハイウエスト・短め丈のアウターで縦の長さを強調。ロングコートは前を開けて。");
    if (heightLv === "tall") out.push("長身を生かしてロング丈のコートやワイドパンツ、重ね着を大胆に。");
    if (gender === "m" && age >= 35) out.push("シャツやジャケットは肩幅と着丈が合っているかを最優先に。");
    return out;
  }

  /* ---------------------------------------------------------------
     6. 結果の表示
     --------------------------------------------------------------- */
  function silhouette(shape) {
    const p = { Y: [1.3, 0.85, 0.88], A: [0.88, 0.85, 1.25], O: [1.0, 1.18, 1.05], I: [0.9, 0.8, 0.88], X: [1.08, 0.72, 1.1], H: [1.0, 0.95, 1.0] }[shape];
    const cx = 60, sw = 28 * p[0], ww = 22 * p[1], hw = 27 * p[2];
    return `<svg viewBox="0 0 120 200" role="img" aria-label="${SHAPES[shape].name}のシルエット">
      <circle cx="60" cy="24" r="14" fill="var(--soft)" stroke="var(--ink)" stroke-width="1.5"/>
      <path d="M${cx - sw},52 Q${cx},44 ${cx + sw},52 L${cx + ww},104 Q${cx + hw + 4},120 ${cx + hw},134 L${cx + hw - 6},192 L${cx + 4},192 L${cx},146 L${cx - 4},192 L${cx - hw + 6},192 L${cx - hw},134 Q${cx - hw - 4},120 ${cx - ww},104 Z"
        fill="var(--soft)" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>
      <line x1="${cx - sw - 6}" y1="52" x2="${cx + sw + 6}" y2="52" stroke="var(--muted)" stroke-dasharray="3 3"/>
      <line x1="${cx - ww - 6}" y1="104" x2="${cx + ww + 6}" y2="104" stroke="var(--muted)" stroke-dasharray="3 3"/>
      <line x1="${cx - hw - 6}" y1="130" x2="${cx + hw + 6}" y2="130" stroke="var(--muted)" stroke-dasharray="3 3"/>
    </svg>`;
  }

  function metric(name, value, unit, range, lo, hi, evalText) {
    if (value == null) return "";
    const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
    return `<div class="metric"><span class="m-name">${name}</span><span class="m-eval">${evalText || ""}</span><br>
      <b>${unit === "ratio" ? value.toFixed(2) : r1(value)}</b> ${unit === "ratio" ? "" : unit}
      <div class="bar"><span class="zone" style="left:${pos(range[0])}%;right:${100 - pos(range[1])}%"></span><span class="dot" style="left:${pos(value)}%"></span></div></div>`;
  }
  const evalWord = (lv) => ({ low: "低め", std: "標準", high: "高め" }[lv] || "");

  function render() {
    if (!state.season) return;
    const body = readBody();
    const ctx = {
      age: num($("#age").value) || 30,
      gender: getChips($("#genderChips"))[0] || "x",
      tastes: getChips($("#tasteChips")),
      color: getChips($("#colorChips"))[0] || "any",
      occ: getChips($("#occChips")),
      avoid: getChips($("#avoidChips")),
      trendLevel: +$("#trendLevel").value,
      seasonKind: state.season.stale ? currentSeasonKind() : state.season.season,
      used: new Set(),
    };
    const a = analyze(body, ctx.gender, ctx.age);
    ctx.shape = a.shape;
    const S = SHAPES[a.shape];
    const outfits = buildOutfits(ctx);
    const trendRates = rateTrends(ctx);

    const tags = [`${S.line}が似合う`];
    if (a.skeleton) tags.push(`骨格 ${a.skeleton} 傾向(参考)`);
    tags.push({ small: "小柄", std: "標準身長", tall: "長身" }[a.heightLv]);

    const balance = a.upperRatio ? (() => {
      const pos = Math.max(0, Math.min(100, ((a.upperRatio - 1.4) / 0.7) * 100));
      return `<div class="balance"><span>下半身寄り</span><div class="bar"><span class="zone" style="left:43%;right:43%"></span><span class="dot" style="left:${pos}%"></span></div><span>上半身寄り</span></div>`;
    })() : "";

    $("#result").innerHTML = `
      ${state.season.stale ? `<p class="note err">流行データ(${esc(state.season.label)})が今の季節より古いため、定番を中心に提案しています。data/trends.json を更新してください。</p>` : ""}
      <div class="r-head">
        ${silhouette(a.shape)}
        <div>
          <p class="r-kicker">あなたの体型</p>
          <p class="r-title">${S.name}</p>
          <p class="r-sub">${S.sub}</p>
          <div class="tags">${tags.map((t, i) => `<span class="tag ${i ? "" : "strong"}">${esc(t)}</span>`).join("")}</div>
        </div>
      </div>

      <div class="r-section">
        <h2>データから見えたこと <small>${a.reasons.map(esc).join(" / ")}</small></h2>
        <div class="metrics">
          ${metric("BMI", a.bmi, "", [18.5, 25], 15, 35, a.bmi < 18.5 ? "低め" : a.bmi > 25 ? "高め" : "標準")}
          ${metric("体脂肪率", a.pbf, "%", a.std.pbf, a.std.pbf[0] - 10, a.std.pbf[1] + 12, evalWord(a.fatLv))}
          ${metric("筋肉量指数(骨格筋量 ÷ 身長²)", a.smi, "", a.std.smi, a.std.smi[0] - 2.5, a.std.smi[1] + 2.5, evalWord(a.musLv))}
          ${metric("ウエストヒップ比", body.whr, "ratio", a.std.whr, a.std.whr[0] - 0.12, a.std.whr[1] + 0.15, evalWord(a.whrLv))}
        </div>
        ${balance}
        ${a.hasLean ? "" : `<p class="note">部位別の筋肉量があると、上半身・下半身のバランスまで判定できます。</p>`}
      </div>

      <div class="r-section">
        <h2>似合わせのポイント</h2>
        <p>${S.aim}</p>
        <div class="dodont">
          <div class="card do"><h3>◯ 取り入れたい</h3><ul>${S.do.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="card dont"><h3>△ 控えたい</h3><ul>${S.dont.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        </div>
      </div>

      <div class="r-section">
        <h2>おすすめコーデ <small>${esc(state.season.label)}</small></h2>
        <div class="outfits">
          ${outfits.map((o) => `
            <article class="card outfit">
              <span class="o-occ">${OCC[o.occ]}</span>
              <h3>${esc(outfitTitle(o))}</h3>
              <div class="o-strip">${o.items.map((i) => `<i style="background:${i.color[1]}" title="${esc(i.color[0])}"></i>`).join("")}</div>
              <ul>${o.items.map((i) => `
                <li><span class="o-cat">${CAT[i.cat]}</span>
                  <span class="o-color" style="background:${i.color[1]}"></span>${esc(i.color[0])}の${esc(i.name)}${i.trend ? '<span class="trend-mark">今季</span>' : ""}
                  <span class="o-tip">${esc(i.tip)}</span></li>`).join("")}
              </ul>
            </article>`).join("")}
        </div>
      </div>

      <div class="r-section">
        <h2>今季のキーワード</h2>
        <p>${esc(state.season.summary)}</p>
        <div class="keywords">${state.season.keywords.map((k) => `<div class="kw"><b>${esc(k.name)}</b><span>${esc(k.desc)}</span></div>`).join("")}</div>
        <div class="palette">${state.season.colors.map((c) => `<span class="sw"><i style="background:${c.hex}"></i>${esc(c.name)}</span>`).join("")}</div>
      </div>

      <div class="r-section">
        <h2>今季の注目アイテムとの相性</h2>
        <ul class="match-list">${trendRates.map((t) => `<li><span class="grade">${t.grade}</span><span><b>${esc(t.name)}</b><small>${esc(t.note)}</small></span></li>`).join("")}</ul>
      </div>

      <div class="r-section">
        <h2>あなたへのひとこと</h2>
        <ul class="advice">${ageAdvice(ctx.age, a.heightLv, ctx.gender).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>`;
  }

  function outfitTitle(o) {
    const trend = o.items.find((i) => i.trend);
    const main = trend || o.items.find((i) => i.cat === "outer") || o.items[0];
    return `${main.name.replace(/^(クラシックな|ひざ丈の|小さめの)/, "")}が主役`;
  }
})();
