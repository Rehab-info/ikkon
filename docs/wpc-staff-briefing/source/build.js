// WPC事業 社員向け説明資料 生成スクリプト
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const md = require("react-icons/md");
const fa = require("react-icons/fa6");
const gi = require("react-icons/gi");
const FIGS = require("./figs.js");
async function svgPng(svg) { const b = await sharp(Buffer.from(svg)).resize(400, 400).png().toBuffer(); return "image/png;base64," + b.toString("base64"); }
const { applyTheme } = require("/root/.claude/skills/synced/b3181c51-b2a0-4dbb-ac4c-7e6d31e71a93_7d03ec08-2ff4-4214-b7fb-7bb0b9c539af/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "WPC_social_briefing.pptx";
const FONT = "Meiryo";

const THEME = {
  name: "WPC Navy",
  headFontFace: FONT,
  bodyFontFace: FONT,
  colors: {
    dk1: "1B2636", lt1: "FFFFFF", dk2: "1E3A5F", lt2: "EAF2FB",
    accent1: "1E3A5F", accent2: "3A7BBF", accent3: "BFD8F0", accent4: "C77700",
    accent5: "2E7D4F", accent6: "B23A3A", hlink: "3A7BBF", folHlink: "5B6B80",
  },
};
const HEX = THEME.colors;
const GRAY = "5B6B80";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
pres.title = "WPC事業｜Buddyshipが目指す新しい産業保健サービス";
pres.author = "株式会社Buddyship";
pres.company = "株式会社Buddyship";
pres.subject = "社員向け事業説明資料";
const C = pres.SchemeColor;

// ---------- icons ----------
const iconCache = {};
async function icon(Comp, hex, size = 256) {
  const key = Comp.name + hex;
  if (iconCache[key]) return iconCache[key];
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return (iconCache[key] = "image/png;base64," + buf.toString("base64"));
}

// ---------- layouts ----------
const FOOT = "WPC事業 社員向け説明資料｜社内限り｜数値はすべて計画上の仮定・試算（実績ではありません）";
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "chap", type: "body", x: 0.6, y: 0.22, w: 9, h: 0.38, fontSize: 14, bold: true, color: C.accent2, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.6, w: 12.13, h: 0.85, fontSize: 30, bold: true, color: C.text2, margin: 0, valign: "middle", align: "left" }, text: "" } },
    { text: { text: FOOT, options: { x: 0.6, y: 7.05, w: 10.5, h: 0.3, fontSize: 10, color: GRAY, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: GRAY, align: "right" },
});
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.0, w: 11.7, h: 1.9, fontSize: 40, bold: true, color: C.background1, margin: 0, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.15, w: 11.7, h: 0.9, fontSize: 22, color: C.accent3, margin: 0, valign: "top" }, text: "" } },
  ],
});

// ---------- helpers ----------
const TAGS = {
  試算: "accent4", 仮説: "accent4", 未確定: "accent4", 承認前: "accent4", 案: "accent4", 仮案: "accent4",
  未実証: "accent4", 未完了: "accent6", 重大: "accent6", "No-Go": "accent6", 確認済み: "accent5", 作成済み: "accent5",
};
function tag(s, text, x, y, w, kind) {
  const k = kind || TAGS[text] || "accent4";
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.36, fill: { color: C[k] || k }, line: { type: "none" }, rectRadius: 0.18, objectName: "tag " + text });
  s.addText(text, { x, y, w, h: 0.36, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
function content(chap, title) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: curSection });
  s.addText(chap, { placeholder: "chap" });
  s.addText(title, { placeholder: "title" });
  return s;
}
let curSection = "";
function section(t) { curSection = t; pres.addSection({ title: t }); }
function card(s, x, y, w, h, fill, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill || C.background2 }, line: { type: "none" }, rectRadius: 0.12, objectName: name || "card" });
}
function txt(s, text, o) {
  s.addText(text, Object.assign({ fontSize: 18, color: C.text1, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 }, o));
}
async function iconCircle(s, Comp, x, y, d, bg, fg) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg || C.text2 }, line: { type: "none" }, objectName: "icon circle" });
  const pad = d * 0.22;
  s.addImage({ data: await icon(Comp, fg || HEX.lt1), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: "icon" });
}
function bullets(items, o = {}) {
  return items.map((t, i) => {
    const base = typeof t === "string" ? { text: t, options: {} } : t;
    return { text: base.text, options: Object.assign({ bullet: { indent: 18 }, breakLine: i < items.length - 1 }, base.options) };
  });
}
function note(s, t) { s.addNotes(t.trim()); }
function glossary(s, text, y = 6.42) {
  card(s, 0.6, y, 12.13, 0.5, C.background2, "glossary");
  txt(s, [{ text: "用語　", options: { bold: true, color: C.accent2 } }, { text }], { x: 0.8, y, w: 11.8, h: 0.5, fontSize: 15, valign: "middle" });
}
function arrowR(s, x, y, w, h, color) {
  s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h, fill: { color: color || C.accent3 }, line: { type: "none" }, objectName: "arrow" });
}

(async () => {
  // ============ 第1章 ============
  section("第1章 WPCとは何か");
  // ---- Slide 1: 表紙
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: curSection });
    s.addText("WPC事業｜Buddyshipが目指す\n新しい産業保健サービス", { placeholder: "title" });
    s.addText("社員向け事業説明会　2026年11月　株式会社Buddyship", { placeholder: "body" });
    card(s, 0.8, 5.35, 11.7, 1.15, C.accent1);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 5.35, w: 11.7, h: 1.15, fill: { color: C.background1, transparency: 88 }, line: { color: C.accent3, width: 1 }, rectRadius: 0.12, objectName: "caution box" });
    txt(s, [
      { text: "この資料の読み方　", options: { bold: true, color: C.background1 } },
      { text: "WPCは準備段階の新規事業です。資料内の金額・人数・効果は計画上の仮定や試算であり、契約・実績・実証済みの効果ではありません。", options: { color: C.background1 } },
    ], { x: 1.1, y: 5.35, w: 11.1, h: 1.15, valign: "middle" });
    txt(s, "産業保健：働く人の健康と安全を職場で守る取り組み", { x: 0.8, y: 6.75, w: 11.7, h: 0.4, fontSize: 15, color: C.accent3 });
    note(s, `
皆さん、お疲れさまです。今日は、当社が準備を進めている新規事業「WPC」について、20〜30分ほどでご説明します。
WPCは、企業で働く方の体の状態を理学療法士が測り、一人ひとりに合った運動を支援する、法人向けの「産業保健サービス」です。産業保健とは、働く人の健康と安全を職場で守る取り組みのことです。
最初にお伝えしたいのは、この事業はまだ準備段階だということです。今日出てくる金額や人数は、すべて計画上の仮定や試算です。契約が決まった企業はまだなく、効果も実証されていません。「何が決まっていて、何がまだ決まっていないか」を区別しながら聞いていただければと思います。
資料の根拠は、事業計画書第4版（正本）、2026年11月4日の独立第三者監査報告書、KPI定義書案、測定マニュアル案、財務モデルVer.1.1、追補Ver.1.1です。`);
  }

  // ---- Slide 2: なぜ
  {
    const s = content("第1章｜WPCとは何か", "なぜこの事業を始めるのか");
    const cols = [
      { x: 0.6, ic: md.MdEngineering, h: "職場の課題", items: ["長時間の立ち作業", "重い物の持ち上げ", "中腰・くり返し動作", "滑りやすい床・段差"] },
      { x: 4.9, ic: fa.FaPersonFalling, h: "従業員への影響", items: ["腰痛など体の痛み", "転倒・つまずき", "疲れやすさ・動きにくさ"] },
      { x: 9.2, ic: md.MdBusiness, h: "企業への影響", items: ["休業を伴う労働災害", "プレゼンティーイズム", "戦力の低下"] },
    ];
    for (const [i, c] of cols.entries()) {
      card(s, c.x, 1.65, 3.53, 3.55);
      await iconCircle(s, c.ic, c.x + 0.25, 1.85, 0.75);
      txt(s, c.h + (i === 2 ? "\n（起こりうること）" : ""), { x: c.x + 1.1, y: 1.85, w: 2.35, h: 0.75, fontSize: i === 2 ? 17 : 19, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(c.items), { x: c.x + 0.2, y: 2.8, w: 3.25, h: 2.3, fontSize: 18 });
      if (i < 2) arrowR(s, c.x + 3.6, 3.15, 0.62, 0.6);
    }
    // stats
    card(s, 0.6, 5.35, 12.13, 0.95, C.background1);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.35, w: 12.13, h: 0.95, fill: { color: C.background1 }, line: { color: C.accent3, width: 1.25 }, rectRadius: 0.12, objectName: "stat box" });
    txt(s, [{ text: "37,195人", options: { fontSize: 30, bold: true, color: C.text2 } }, { text: "　転倒", options: { fontSize: 18 } }], { x: 0.85, y: 5.35, w: 3.6, h: 0.95, valign: "middle" });
    txt(s, [{ text: "22,166人", options: { fontSize: 30, bold: true, color: C.text2 } }, { text: "　動作の反動・無理な動作", options: { fontSize: 16 } }], { x: 4.0, y: 5.35, w: 4.8, h: 0.95, valign: "middle" });
    txt(s, "2025年・全国・全業種の休業4日以上の労働災害（厚生労働省）。盛岡の企業の実態やWPCの効果を示す数字ではありません", { x: 8.75, y: 5.35, w: 3.85, h: 0.95, fontSize: 13, color: GRAY, valign: "middle" });
    glossary(s, "プレゼンティーイズム＝出勤していても、健康上の問題で仕事の能力を十分に発揮できない状態");
    note(s, `
なぜこの事業を始めるのか、です。左から右へ読んでください。
立ち作業、重い物の持ち上げ、中腰やくり返し動作、滑りやすい床。こうした職場の身体的な負担は、腰痛や転倒といった形で従業員に影響します。それが企業にとっては、休業を伴う労働災害や、「プレゼンティーイズム」――出勤はしているけれど、体の不調で力を発揮しきれない状態――につながる可能性があります。
下の数字は、厚生労働省が公表した2025年の全国・全業種の統計で、休業4日以上の労働災害のうち、転倒が37,195人、無理な動作などが22,166人でした。ただし、これは全国の統計であり、盛岡の企業で同じことが起きている証拠でも、WPCで減らせるという証拠でもありません。課題が社会に存在する、という背景として使っています。
また2026年4月から、高年齢労働者の労災防止措置が事業者の努力義務になりましたが、WPCを買うことが義務になったわけではない点も補足します。`);
  }

  // ---- Slide 3: 一言で
  {
    const s = content("第1章｜WPCとは何か", "WPCを一言で説明すると");
    card(s, 0.6, 1.6, 12.13, 1.05, C.text2);
    txt(s, "企業を訪問し、従業員の体の動きを測り、一人ひとりに合った運動を支援し、職場には集計結果を報告するサービス", { x: 0.9, y: 1.6, w: 11.6, h: 1.05, fontSize: 21, bold: true, color: C.background1, valign: "middle" });
    const steps = [
      { ic: md.MdDirectionsCar, h: "① 訪問する", d: "理学療法士が企業の職場へ出向く" },
      { ic: fa.FaPersonWalking, h: "② 測る", d: "1人ずつ、安全に体の動きを測定" },
      { ic: md.MdSportsGymnastics, h: "③ 支援する", d: "その人に合った運動を1〜2種目" },
      { ic: md.MdAssessment, h: "④ 報告する", d: "企業へは個人が分からない集計のみ" },
    ];
    for (const [i, st] of steps.entries()) {
      const x = 0.6 + i * 3.1;
      card(s, x, 2.85, 2.75, 2.6);
      await iconCircle(s, st.ic, x + 0.9, 3.0, 0.95);
      txt(s, st.h, { x: x + 0.15, y: 4.02, w: 2.45, h: 0.45, fontSize: 21, bold: true, color: C.text2, align: "center" });
      txt(s, st.d, { x: x + 0.2, y: 4.5, w: 2.35, h: 0.9, align: "center" });
      if (i < 3) arrowR(s, x + 2.8, 4.1, 0.27, 0.4);
    }
    txt(s, [
      { text: "同じ従業員に年3〜4回くり返す計画（回数は未確定）。料金を払うのは企業です", options: {} },
    ], { x: 0.6, y: 5.6, w: 12.13, h: 0.7, fontSize: 18, valign: "middle" });
    glossary(s, "理学療法士（PT）＝体の動きの専門職（国家資格）。WPCでは診断・治療は行わない", 6.42);
    note(s, `
WPCを一言で言うと、「企業を訪問し、従業員の体の動きを測り、一人ひとりに合った運動を支援し、職場には集計結果を報告するサービス」です。
担当するのは理学療法士、PTです。PTは体の動きの専門職ですが、WPCでは病気の診断や治療は行いません。あくまで健康づくりのための測定と運動指導です。
流れは4つです。①企業の職場を訪問し、②1人ずつ安全に測定し、③その人に合った運動を1〜2種目指導し、④企業へは個人が特定できない集計結果だけを報告します。
これを同じ従業員に年3〜4回くり返し、変化を追いかけるのが特徴の一つです。ただし年3回か4回かは、まだ決まっていません。料金を払うのは企業で、対象は盛岡市と周辺地域の企業を想定しています。`);
  }

  // ---- Slide 4: 違い
  {
    const s = content("第1章｜WPCとは何か", "従来の健康支援と何が違うのか");
    const rows = [
      ["", "一般的な単発型（セミナー・測定会）", "WPCの計画"],
      ["回数", "1回で完結することが多い", "同じ人に年3〜4回"],
      ["測定・指導", "講義や集団での測定が中心", "PTが1対1で測定し、運動を個別に調整"],
      ["結果の使い方", "その場の結果票で終わりやすい", "前回と比べて変化を追い、集計で報告"],
      ["職場とのつながり", "イベントとして実施", "勤務の中に参加枠や職場体操を組み込む"],
    ];
    const tbl = rows.map((r, i) => r.map((c, j) => ({
      text: c,
      options: {
        bold: i === 0 || j === 0, fontSize: 18,
        color: i === 0 ? C.background1 : j === 0 ? C.text2 : C.text1,
        fill: { color: i === 0 ? (j === 2 ? C.accent2 : C.text2) : j === 2 ? C.background2 : C.background1 },
        valign: "middle", margin: [4, 10, 4, 10],
      },
    })));
    s.addTable(tbl, { x: 0.6, y: 1.65, w: 12.13, colW: [2.4, 4.6, 5.13], rowH: 0.62, border: { type: "solid", pt: 1, color: HEX.accent3 } });
    card(s, 0.6, 5.0, 12.13, 1.3, C.background1);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.0, w: 12.13, h: 1.3, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "caution" });
    tag(s, "仮説", 0.85, 5.15, 1.0);
    txt(s, "この違いは「差別化の仮説」です。企業がお金を払う価値と感じるか、効果があるかはまだ確かめていません。盛岡には無料の公的支援（PT派遣・出前講座など）もあり、それらも比較相手です。", { x: 2.05, y: 5.08, w: 10.5, h: 1.15, fontSize: 18, valign: "middle" });
    note(s, `
従来の健康支援との違いです。一般的な単発型のセミナーや測定会は、1回で完結し、講義や集団測定が中心になることが多いです。
WPCの計画では、同じ人に年3〜4回、PTが1対1で測定し、運動を個別に調整し、前回との変化を追いかけ、勤務の中に参加枠や職場体操を組み込みます。
ただし、ここで強調したいのは、これは「差別化の仮説」だということです。企業がこの違いにお金を払う価値を感じるか、実際に効果があるかは、まだ確かめていません。
また盛岡・岩手には、岩手産業保健総合支援センターによる無料の職場訪問支援や、盛岡市の出前講座などがあります。有料のWPCを選んでもらうには、これら無料支援との違いを説明できる必要があります。他社のサービスも、測定だけで終わるとは限らない点にご注意ください。`);
  }

  // ============ 第2章 ============
  section("第2章 サービスの仕組み");
  // ---- Slide 5: 全体像
  {
    const s = content("第2章｜サービスの仕組み", "サービス全体の流れ");
    const st = [
      ["契約", "企業の本部と条件を決める"],
      ["事前準備", "参加枠・会場・本人の同意"],
      ["測定", "1人ずつ安全確認して測る"],
      ["個別支援", "運動1〜2種目を指導"],
      ["集計報告", "企業へは集計のみ"],
      ["継続支援", "職場体操・週1回の記録"],
      ["再評価", "数か月後に同じ条件で測る"],
    ];
    const w = 1.62, gap = 0.135;
    for (const [i, [h, d]] of st.entries()) {
      const x = 0.6 + i * (w + gap);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.8, w, h: 0.75, fill: { color: i === 2 || i === 6 ? C.accent2 : C.text2 }, line: { type: "none" }, objectName: "flow " + h });
      txt(s, h, { x: x + (i === 0 ? 0.05 : 0.3), y: 1.8, w: w - (i === 0 ? 0.35 : 0.55), h: 0.75, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle", fit: "none" });
      card(s, x, 2.9, w - 0.05, 1.6);
      txt(s, d, { x: x + 0.1, y: 3.0, w: w - 0.25, h: 1.4, fontSize: 17 });
    }
    // loop arrow 再評価→測定
    const xm = 0.6 + 2 * (w + gap) + w / 2, xr = 0.6 + 6 * (w + gap) + w / 2;
    s.addShape(pres.shapes.LINE, { x: xm, y: 4.6, w: 0, h: 0.4, line: { color: HEX.accent2, width: 2.5, beginArrowType: "triangle" } });
    s.addShape(pres.shapes.LINE, { x: xm, y: 5.0, w: xr - xm, h: 0, line: { color: HEX.accent2, width: 2.5 } });
    s.addShape(pres.shapes.LINE, { x: xr, y: 4.6, w: 0, h: 0.4, line: { color: HEX.accent2, width: 2.5 } });
    txt(s, "くり返して変化を確認", { x: xm + 2.0, y: 5.05, w: 4.5, h: 0.4, fontSize: 18, bold: true, color: C.accent2, align: "center" });
    card(s, 0.6, 5.6, 12.13, 0.75);
    tag(s, "未確定", 0.8, 5.79, 1.2);
    txt(s, "回数の案：年3回（初回・4か月後・8か月後）／年4回（初回・3・6・9か月後）", { x: 2.2, y: 5.6, w: 10.4, h: 0.75, valign: "middle" });
    note(s, `
サービス全体の流れです。左から、契約、事前準備、測定、個別支援、集計報告、継続支援、再評価と進みます。
契約は企業の本部と結びます。事前準備では、勤務時間内の参加枠、会場、本人の同意を確認します。測定は1人ずつ体調を確認してから行い、測定後にその人に合った運動を1〜2種目指導します。企業へは個人が特定できない集計だけを報告します。
その後は職場での短い体操や、週1回の記録で運動を続けてもらい、数か月後に同じ条件で再評価します。測定から再評価までをくり返して、変化を確認していく仕組みです。
回数は年3回案と年4回案があり、まだ確定していません。資料によって前提が違うため、最終的には責任者が一つに決める必要があります。`);
  }

  // ---- Slide 6: メリット
  {
    const s = content("第2章｜サービスの仕組み", "企業と従業員、それぞれに期待される価値");
    const col = async (x, ic, h, items) => {
      card(s, x, 1.65, 5.9, 3.9);
      await iconCircle(s, ic, x + 0.3, 1.85, 0.8);
      txt(s, h, { x: x + 1.3, y: 1.85, w: 4.4, h: 0.8, fontSize: 22, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(items), { x: x + 0.35, y: 2.85, w: 5.3, h: 2.6, paraSpaceAfter: 8 });
    };
    await col(0.6, md.MdBusiness, "企業（本部・現場）", ["従業員の体の状態を集計で把握できる", "同じ人たちの変化を時間を追って確認できる", "安全衛生・健康経営の取り組みの材料になる", "職場環境の課題に気づくきっかけになる"]);
    await col(6.83, md.MdPerson, "従業員", ["自分の体の状態と前回からの変化が分かる", "自分に合った、続けやすい運動が分かる", "勤務時間内に参加できるよう企業と調整する", "参加は任意。断っても不利益はない"]);
    tag(s, "未実証", 0.6, 5.72, 1.3);
    txt(s, "上記は「期待される価値」です。転倒が減る・腰痛が治る・医療費が下がる・生産性が上がる、とは約束しません。", { x: 2.1, y: 5.65, w: 10.6, h: 0.75, valign: "middle" });
    note(s, `
企業と従業員、それぞれに期待される価値です。
企業にとっては、従業員の体の状態を集計で把握でき、同じ人たちの変化を追いかけられること、安全衛生や健康経営の取り組みの材料になること、職場環境の課題に気づくきっかけになることが期待されます。
従業員にとっては、自分の体の状態と前回からの変化が分かること、続けやすい運動が分かること、勤務時間内に参加できるよう調整されることが期待されます。参加は任意で、断っても不利益がないようにします。
大事なのは、これらはすべて「期待される価値」であり、効果は実証されていないことです。事業計画書でも、転倒を防ぐ、医療費が下がる、必ず改善する、とは約束しないと定めています。社外で話すときも、この言い方を守ってください。`);
  }

  // ---- Slide 7: 測定
  {
    const s = content("第2章｜サービスの仕組み", "身体機能測定では何をするのか");
    const items = [
      { fig: "twostep", h: "2ステップ", d: "できるだけ大股で2歩進み、距離を身長で割る" },
      { fig: "seated", h: "座位ステッピング", d: "椅子に座り、20秒間に両足を床の線の内外へ動かす回数" },
      { fig: "standup", h: "立ち上がり", d: "40cmの台から腕を組んで反動なしで立ち上がれるか" },
      { fig: "oneleg", h: "開眼片脚立位", d: "目を開けたまま片脚で何秒立っていられるか" },
    ];
    for (const [i, it] of items.entries()) {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.65, 2.85, 3.55);
      s.addShape(pres.shapes.OVAL, { x: x + 0.62, y: 1.85, w: 1.6, h: 1.6, fill: { color: C.background1 }, line: { color: C.accent3, width: 1.5 }, objectName: "illust circle" });
      s.addImage({ data: await svgPng(FIGS[it.fig]), x: x + 0.77, y: 2.0, w: 1.3, h: 1.3, altText: it.h + "の測定姿勢のイラスト" });
      txt(s, it.h, { x: x + 0.1, y: 3.55, w: 2.65, h: 0.45, fontSize: 20, bold: true, color: C.text2, align: "center" });
      txt(s, it.d, { x: x + 0.15, y: 4.0, w: 2.55, h: 1.15, fontSize: 17 });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.35, w: 12.13, h: 1.5, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "caution" });
    tag(s, "承認前", 0.85, 5.5, 1.2);
    txt(s, bullets([
      "測定項目は最終承認前の案です。監査では、40cm両脚の立ち上がりはほぼ全員が成功して差が出ない、などの見直しが提案されています",
      "体組成計（InBody）は資料により「毎回」「任意」と扱いが異なり、機器も未保有です",
    ]), { x: 2.2, y: 5.45, w: 10.35, h: 1.35, fontSize: 17 });
    note(s, `
測定の内容です。現在の基本案は4つです。
1つ目は2ステップ。できるだけ大股で2歩進み、その距離を身長で割ります。2つ目は座位ステッピング。椅子に座ったまま、20秒間に両足を床の線の内側と外側へ動かした回数を数えます。3つ目は立ち上がり。40cmの台から腕を組んで、反動を使わずに立ち上がれるかを見ます。4つ目は開眼片脚立位。目を開けたまま片脚で何秒立てるかを測ります。
いずれも診断ではなく、体の動きの状態を知るための測定です。体調確認をしてから行い、危ないと判断した人には無理に実施しません。
ただし、これらは最終承認前の案です。第三者監査では、40cmの両脚立ち上がりは働く世代ではほぼ全員成功して差が出にくいこと、片脚立位は上限の180秒に達する人が多いことなどが指摘され、片脚での立ち上がりや5回椅子立ち座りへの変更が提案されています。体組成計InBodyも、資料によって毎回測るのか任意なのか扱いが違い、機器も持っていません。模擬測定を経て、正式に決めます。`);
  }

  // ---- Slide 8: 結果の活用
  {
    const s = content("第2章｜サービスの仕組み", "測定結果はどう使うのか");
    // center
    card(s, 5.17, 2.2, 3.0, 2.3, C.text2);
    await iconCircle(s, md.MdLock, 6.17, 2.35, 1.0, C.accent2);
    txt(s, "測定データ\nWPCが管理", { x: 5.17, y: 3.45, w: 3.0, h: 0.95, fontSize: 20, bold: true, color: C.background1, align: "center" });
    // left: person
    card(s, 0.6, 1.65, 3.75, 3.4);
    await iconCircle(s, md.MdPerson, 0.85, 1.85, 0.75);
    txt(s, "本人へ", { x: 1.75, y: 1.85, w: 2.4, h: 0.75, fontSize: 22, bold: true, color: C.text2, valign: "middle" });
    txt(s, bullets(["今回と前回の結果票", "測定の限界の説明", "続けやすい運動", "本人だけに手渡す"]), { x: 0.85, y: 2.75, w: 3.35, h: 2.2 });
    // right: company
    card(s, 8.98, 1.65, 3.75, 3.4);
    await iconCircle(s, md.MdBusiness, 9.23, 1.85, 0.75);
    txt(s, "企業へ", { x: 10.13, y: 1.85, w: 2.4, h: 0.75, fontSize: 22, bold: true, color: C.text2, valign: "middle" });
    txt(s, bullets(["参加人数・継続状況", "集団の平均や割合", "10人未満は原則非表示", "職場環境・運営の課題"]), { x: 9.23, y: 2.75, w: 3.35, h: 2.2 });
    s.addShape(pres.shapes.LEFT_ARROW, { x: 4.45, y: 3.05, w: 0.62, h: 0.55, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "arrow" });
    arrowR(s, 8.27, 3.05, 0.62, 0.55);
    card(s, 0.6, 5.25, 12.13, 1.6, C.background2);
    txt(s, [
      { text: "個人の健康情報が企業へ無制限に渡る仕組みではありません", options: { bold: true, color: C.text2, breakLine: true, fontSize: 19 } },
      { text: "企業が料金を払っても、個人の測定値や健康の回答は見られない設計です。参加しないことや結果を、人事評価に使わないことを企業と取り決めます。", options: { breakLine: true } },
      { text: "※情報の法的な扱い（WPCが本人から直接預かるか、企業の委託を受けるか）は未確定です", options: { fontSize: 15, color: C.accent4 } },
    ], { x: 0.85, y: 5.33, w: 11.7, h: 1.45, paraSpaceAfter: 2 });
    note(s, `
測定結果の使い方です。測定データはWPCが管理し、使い道を2つに分けます。
本人には、今回と前回の結果票、測定の限界の説明、続けやすい運動と中止の目安を、本人だけに手渡します。
企業には、参加人数や継続状況、集団としての平均や割合だけを報告します。原則として10人未満の小さな集団は、個人が推測されないよう表示しません。
つまり、企業が料金を払っていても、個人の測定値や健康に関する回答を見ることはできない設計です。また、参加しないことや結果を人事評価に使わないことを、企業と取り決めます。
一方で、監査では「WPCが本人から直接情報を預かるのか、企業から委託を受けて扱うのか」という法的な構造がまだ決まっていないことが指摘されています。これによって企業が見られる範囲が変わるため、開始前に必ず確定させます。`);
  }

  // ---- Slide 9: 運動支援
  {
    const s = content("第2章｜サービスの仕組み", "測定後の運動支援");
    const blocks = [
      { ic: md.MdSportsGymnastics, h: "個別運動指導", items: ["測定当日にPTが指導", "原則1〜2種目", "本人が自分でできるまで確認", "痛む動作は続けさせない"] },
      { ic: md.MdGroups, h: "職場での運動", items: ["1〜3分程度の短い体操", "勤務内の取りやすい時間", "荷物を持ったまま行わない", "参加しなくても不利益なし"] },
      { ic: md.MdEventNote, h: "継続支援", items: ["週1回を目安に実施を記録", "次回訪問で運動を見直す", "症状がある人は受診を案内", "医療相談・治療は行わない"] },
    ];
    for (const [i, b] of blocks.entries()) {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.65, 3.88, 3.55);
      await iconCircle(s, b.ic, x + 0.25, 1.85, 0.75);
      txt(s, b.h, { x: x + 1.15, y: 1.85, w: 2.6, h: 0.75, fontSize: 21, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(b.items), { x: x + 0.3, y: 2.8, w: 3.45, h: 2.3, paraSpaceAfter: 6 });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.4, w: 12.13, h: 1.4, fill: { color: C.background1 }, line: { color: GRAY, width: 1.25, dashType: "dash" }, rectRadius: 0.12, objectName: "web pending" });
    tag(s, "未確定", 0.85, 5.55, 1.2);
    txt(s, "Webでの継続支援（運動メニュー・記録・リマインド）は計画書に記載がありますが、当面は専用システムを導入しない方針です。記録は紙・メール・既存ツールで行う案で、方法はまだ決まっていません。", { x: 2.25, y: 5.45, w: 10.3, h: 1.3, valign: "middle" });
    note(s, `
測定後の運動支援は3つの層で考えています。
1つ目は個別運動指導です。測定当日にPTが、原則1〜2種目の運動を、本人が自分でできるようになるまで確認しながら指導します。痛みが出る動作は続けさせません。
2つ目は職場での運動です。1〜3分程度の短い体操を、勤務時間内の取りやすいタイミングに組み込みます。安全のため荷物を持ったままでは行わず、参加しなくても不利益がないようにします。
3つ目は継続支援です。週1回を目安に実施状況を記録してもらい、次の訪問で運動を見直します。症状がある方には受診を案内し、医療相談や治療は行いません。
注意点として、計画書には「開催の間のWeb支援」が書かれていますが、追補では当面、専用システムを導入しない方針になっています。監査でも「約束を実装できる範囲に合わせるべき」と指摘されました。Web支援は確定したサービスではありませんので、社外で約束しないでください。`);
  }

  // ============ 第3章 ============
  section("第3章 誰に提供するのか");
  // ---- Slide 10: 対象企業
  {
    const s = content("第3章｜誰に提供するのか", "対象となる企業と提案の切り口");
    const rows = [
      [md.MdRestaurant, "食品製造", "A", "立ち作業・くり返し動作・中腰", "作業を見たうえで測定と個別運動"],
      [md.MdLocalShipping, "物流倉庫", "A", "荷物の持ち上げ・歩行・低温環境", "荷役の負担把握と転倒・腰痛対策"],
      [md.MdHotel, "ホテル宿泊", "A", "客室清掃の中腰・厨房の立ち作業", "繁忙時間を避けた分割参加枠"],
      [md.MdFactory, "製造業", "A", "持ち上げ・反復動作・長時間立位", "工場の勤務・衛生条件に合わせる"],
      [md.MdStore, "小売（既存候補）", "別枠", "品出し・レジ・バックヤード", "本部一括契約で近隣店舗へ"],
    ];
    const y0 = 1.6, rh = 0.8;
    const hdr = ["業種", "優先", "主な身体的負担（仮説）", "提案の切り口"];
    const xs = [0.6, 3.6, 4.55, 8.85], ws = [3.0, 0.95, 4.3, 3.88];
    for (let j = 0; j < 4; j++) {
      s.addShape(pres.shapes.RECTANGLE, { x: xs[j], y: y0, w: ws[j], h: 0.55, fill: { color: C.text2 }, line: { color: HEX.lt1, width: 1 }, objectName: "th" });
      txt(s, hdr[j], { x: xs[j] + 0.12, y: y0, w: ws[j] - 0.2, h: 0.55, bold: true, color: C.background1, valign: "middle", fontSize: 18 });
    }
    for (const [i, r] of rows.entries()) {
      const y = y0 + 0.55 + i * rh;
      const fill = i % 2 ? C.background1 : C.background2;
      for (let j = 0; j < 4; j++) s.addShape(pres.shapes.RECTANGLE, { x: xs[j], y, w: ws[j], h: rh, fill: { color: fill }, line: { color: HEX.accent3, width: 1 }, objectName: "td" });
      await iconCircle(s, r[0], xs[0] + 0.12, y + 0.12, 0.56);
      txt(s, r[1], { x: xs[0] + 0.8, y, w: 2.15, h: rh, bold: true, color: C.text2, valign: "middle", fontSize: 18 });
      tag(s, r[2], xs[1] + 0.1, y + 0.22, 0.75, r[2] === "A" ? "accent2" : GRAY);
      txt(s, r[3], { x: xs[2] + 0.12, y, w: ws[2] - 0.22, h: rh, valign: "middle", fontSize: 17 });
      txt(s, r[4], { x: xs[3] + 0.12, y, w: ws[3] - 0.22, h: rh, valign: "middle", fontSize: 17 });
    }
    txt(s, "優先度B：ホームセンター・介護福祉・清掃・外食　／　C：運送・建設設備。負担は職務からの仮説で、各社で問題が起きていると確認したものではありません。", { x: 0.6, y: 6.25, w: 12.13, h: 0.65, fontSize: 15, color: GRAY });
    note(s, `
対象となる企業です。2026年11月4日の改訂で、WPCは小売中心から「業種横断」の方針に変わりました。
優先度Aは、食品製造、物流倉庫、ホテル宿泊、製造業です。食品製造では立ち作業やくり返し動作、物流では荷物の持ち上げや低温環境、ホテルでは客室清掃の中腰や厨房の立ち作業などが考えられます。スーパーやドラッグストアなどの小売は、従来からの候補として別枠で並行して当たります。
優先度Bはホームセンター、介護福祉、清掃、外食、Cは運送、建設設備です。
ここに書いた身体的負担は、仕事の内容から考えた「仮説」です。候補企業で実際に腰痛や事故が起きていると確認したものではありません。また、業種によって衛生区域、交替勤務、会場の条件が大きく異なるため、提案は企業ごとに個別に設計する必要があります。監査では、最初は1業種・1法人に絞るべきと提案されています。`);
  }

  // ---- Slide 11: 盛岡から・営業
  {
    const s = content("第3章｜誰に提供するのか", "盛岡から始める理由と営業の進め方");
    card(s, 0.6, 1.65, 4.6, 3.6);
    await iconCircle(s, md.MdLocationOn, 0.85, 1.85, 0.75);
    txt(s, "盛岡から始める理由", { x: 1.75, y: 1.85, w: 3.3, h: 0.75, fontSize: 20, bold: true, color: C.text2, valign: "middle" });
    txt(s, bullets(["訪問できる範囲で品質と安全を保てる", "同じ従業員を追いかけやすい", "移動の時間と費用を抑えられる"]), { x: 0.85, y: 2.8, w: 4.2, h: 2.3, paraSpaceAfter: 8 });
    const steps = ["候補企業の確認", "課題のヒアリング", "条件付きの見積", "有料パイロット（1法人）", "年間契約の判断"];
    for (const [i, t] of steps.entries()) {
      const y = 1.65 + i * 0.72;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.55, y, w: 4.3, h: 0.6, fill: { color: i === 3 ? C.accent2 : C.text2 }, line: { type: "none" }, rectRadius: 0.1, objectName: "sales step" });
      txt(s, `${i + 1}  ${t}`, { x: 5.75, y, w: 4.0, h: 0.6, bold: true, color: C.background1, valign: "middle" });
      if (i < 4) s.addShape(pres.shapes.DOWN_ARROW, { x: 7.55, y: y + 0.6, w: 0.3, h: 0.12, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "arrow" });
    }
    card(s, 10.1, 1.65, 2.63, 3.6);
    txt(s, "最初の目標", { x: 10.25, y: 1.75, w: 2.35, h: 0.4, bold: true, color: C.text2 });
    txt(s, [
      { text: "面談 8件以上", options: { breakLine: true } },
      { text: "見積 3件以上", options: { breakLine: true } },
      { text: "有料発注 1件以上", options: {} },
    ], { x: 10.25, y: 2.2, w: 2.4, h: 1.5, paraSpaceAfter: 8 });
    txt(s, "（目標案。実績ではない）", { x: 10.25, y: 3.75, w: 2.4, h: 0.4, fontSize: 14, color: GRAY });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.45, w: 12.13, h: 0.95, fill: { color: C.background1 }, line: { color: C.accent6, width: 1.75 }, rectRadius: 0.12, objectName: "warn" });
    txt(s, [
      { text: "2026年11月4日時点：面談・見積・発注は0件。", options: { bold: true, color: C.accent6 } },
      { text: "優先候補4社（食品製造2・物流1・ホテル1）と小売7法人は、すべて「営業候補」で契約済みではありません。" },
    ], { x: 0.85, y: 5.45, w: 11.7, h: 0.95, valign: "middle" });
    glossary(s, "有料パイロット＝本格販売の前に、1つの企業で小規模に有料で試すこと", 6.5);
    note(s, `
盛岡から始める理由と、営業の進め方です。
盛岡から始めるのは、訪問できる範囲で品質と安全を保てること、同じ従業員を継続して追いかけやすいこと、移動の時間と費用を抑えられることが理由です。
営業は、候補企業の確認、課題のヒアリング、条件付きの見積、そして「有料パイロット」へ進みます。有料パイロットとは、本格販売の前に、1つの企業で小規模に、有料で試すことです。その結果を見て年間契約を判断します。
最初の目標は、面談8件以上、見積3件以上、有料発注1件以上です。これは目標であって実績ではありません。
ここが一番誤解されやすいところなので強調します。11月4日時点で、面談・見積・発注はいずれも0件です。優先候補4社や小売の7法人は、あくまで営業の候補であり、契約済みでも導入意向が確認できたわけでもありません。社外では候補企業の名前を出さないようにしてください。`);
  }

  // ============ 第4章 ============
  section("第4章 ビジネスモデル");
  // ---- Slide 12: 収益の仕組み
  {
    const s = content("第4章｜ビジネスモデル", "WPCの収益の仕組み");
    card(s, 0.6, 1.8, 3.6, 2.6);
    await iconCircle(s, md.MdBusiness, 1.9, 1.95, 1.0);
    txt(s, "企業（本部）", { x: 0.7, y: 3.05, w: 3.4, h: 0.45, fontSize: 21, bold: true, color: C.text2, align: "center" });
    txt(s, "従業員の参加時間も負担する", { x: 0.8, y: 3.55, w: 3.2, h: 0.7, fontSize: 17, align: "center" });
    card(s, 9.13, 1.8, 3.6, 2.6, C.text2);
    await iconCircle(s, md.MdHealthAndSafety, 10.43, 1.95, 1.0, C.accent2);
    txt(s, "Buddyship（WPC）", { x: 9.2, y: 3.05, w: 3.46, h: 0.45, fontSize: 21, bold: true, color: C.background1, align: "center" });
    txt(s, "スタッフの時間・交通・保険などの費用がかかる", { x: 9.33, y: 3.55, w: 3.2, h: 0.75, fontSize: 17, color: C.background1, align: "center" });
    arrowR(s, 4.35, 2.0, 4.65, 0.75, C.accent2);
    txt(s, "サービス料金を支払う", { x: 4.55, y: 2.0, w: 4.25, h: 0.75, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
    s.addShape(pres.shapes.LEFT_ARROW, { x: 4.35, y: 3.3, w: 4.65, h: 0.75, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "arrow" });
    txt(s, "測定・個別指導・集計報告", { x: 4.55, y: 3.3, w: 4.25, h: 0.75, fontSize: 18, bold: true, color: C.text2, align: "center", valign: "middle" });
    // equation
    const eq = [["売上", "企業から受け取る料金", C.accent2], ["−", "", null], ["費用", "サービス提供にかかるお金", C.accent4], ["=", "", null], ["利益", "会社に残るお金", C.accent5]];
    let x = 1.3;
    for (const [a, b, col] of eq) {
      if (!col) { txt(s, a, { x, y: 4.85, w: 0.6, h: 1.1, fontSize: 36, bold: true, color: C.text2, align: "center", valign: "middle" }); x += 0.6; continue; }
      card(s, x, 4.85, 3.0, 1.1, col);
      txt(s, [{ text: a, options: { fontSize: 24, bold: true, breakLine: true } }, { text: b, options: { fontSize: 16 } }], { x, y: 4.85, w: 3.0, h: 1.1, color: C.background1, align: "center", valign: "middle" });
      x += 3.0;
    }
    txt(s, "料金を払うのは企業（本部）です。売上が増えても、費用がそれ以上に増えれば利益は出ません。", { x: 0.6, y: 6.15, w: 12.13, h: 0.7, fontSize: 18 });
    note(s, `
WPCの収益の仕組みはシンプルです。企業、具体的には本部がサービス料金を支払い、Buddyshipは測定、個別指導、集計報告を提供します。
ただし、企業は料金だけでなく、従業員が勤務中に参加する時間も負担しています。私たちの側にも、スタッフの時間、交通費、消耗品、保険などの費用がかかります。
覚えておいていただきたいのは下の式です。売上から費用を引いたものが利益です。売上が増えても、費用がそれ以上に増えれば利益は出ません。特にWPCは、人が1人ずつ対応するサービスなので、人数が増えると時間と人件費も増えます。この点が次のスライドの価格の話につながります。`);
  }

  // ---- Slide 13: 価格
  {
    const s = content("第4章｜ビジネスモデル", "価格は未確定：3つの案が並んでいます");
    s.addChart(pres.charts.BAR, [
      { name: "売上", labels: ["3,000円/人回", "6,000円/人回"], values: [48, 96] },
      { name: "変動費（提供で増える費用）", labels: ["3,000円/人回", "6,000円/人回"], values: [70, 70] },
    ], {
      x: 0.6, y: 1.55, w: 6.4, h: 4.0, barDir: "col", barGrouping: "clustered",
      chartColors: [HEX.accent2, HEX.accent4],
      showTitle: true, title: "40人・2拠点・年4回の場合（万円/年）", titleFontSize: 15, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 16, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
      catAxisLabelFontSize: 16, catAxisLabelColor: HEX.dk1, catAxisLabelFontFace: "+mn-lt",
      valAxisLabelFontSize: 13, valAxisLabelColor: GRAY, valAxisLabelFontFace: "+mn-lt", valAxisMinVal: 0, valAxisMaxVal: 120, valAxisMajorUnit: 20,
      valGridLine: { color: "D9E3EE", size: 0.75 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendFontSize: 15, legendFontFace: "+mn-lt", legendColor: HEX.dk1,
    });
    txt(s, "費用は財務モデルの定常年間計算（職員の時間も含む）の約70万円", { x: 0.6, y: 5.55, w: 6.4, h: 0.35, fontSize: 13, color: GRAY, align: "center" });
    txt(s, [
      { text: "限界利益　", options: { bold: true } },
      { text: "3,000円 ▲22万円", options: { bold: true, color: C.accent6 } },
      { text: "／" },
      { text: "6,000円 ＋26万円", options: { bold: true, color: C.accent5 } },
    ], { x: 0.6, y: 5.92, w: 6.4, h: 0.45, fontSize: 18, align: "center" });
    const cards = [
      ["3,000円/人回", "第4版正本の価格仮説。20人・年3回で年18万円/拠点。1人30分・20分の枠では約▲0.4万円/拠点"],
      ["6,000円/人回", "別計画Ver.1.0・財務モデル。40人2拠点・年4回で年96万円"],
      ["6,500円/人回相当", "追補Ver.1.1。20人1拠点・年4回で年52万円（条件が異なり左の図に入れていません）"],
    ];
    for (const [i, [h, d]] of cards.entries()) {
      const y = 1.6 + i * 1.3;
      card(s, 7.3, y, 5.43, 1.15);
      txt(s, h, { x: 7.5, y: y + 0.08, w: 3.0, h: 0.4, fontSize: 19, bold: true, color: C.text2 });
      txt(s, d, { x: 7.5, y: y + 0.46, w: 5.15, h: 0.66, fontSize: 14.5 });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 5.5, w: 5.43, h: 0.9, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "caution" });
    txt(s, "監査は「3,000円は撤回、6,000円前後を軸に3価格で支払意思を確かめる」ことを提案。決定はまだです", { x: 7.45, y: 5.5, w: 5.2, h: 0.9, fontSize: 15, valign: "middle" });
    glossary(s, "限界利益＝売上から、提供に伴って増える費用を引いた利益　／　円/人回＝参加者1人・1回あたりの料金", 6.5);
    note(s, `
価格です。結論から言うと、価格はまだ決まっていません。資料によって3つの案が並んでいます。
3,000円は、事業計画書第4版の価格仮説です。6,000円は、別の計画書Ver.1.0と財務モデルが使っている、40人・2拠点・年4回で年96万円の案です。6,500円相当は、追補の20人・1拠点・年4回で年52万円の案です。
左のグラフは、条件をそろえられる2案だけを比べています。40人・2拠点・年4回で、提供に伴って増える費用、つまり変動費を約70万円とすると、3,000円では売上48万円で、限界利益は22万円の赤字になります。6,000円なら26万円の黒字です。限界利益とは、売上から提供に伴って増える費用を引いたもので、会社の固定費はここから払います。
6,500円案は人数や拠点の条件が違うため、同じグラフには入れず、優劣も判断していません。
なお、第4版の3,000円は、測定枠を1人30分・再評価20分に延ばした再計算では、20人・年3回の1拠点で約3,900円の赤字になります。また有料パイロットの価格も、第4版の24万円と別計画の40〜48万円に分かれており、監査は直接原価が約35万円のため24万円では約11万円の赤字になると指摘しています。「円/人回」は参加者1人・1回あたりの料金という意味です。
第三者監査は、3,000円では構造的に赤字になるため撤回し、6,000円前後を軸に3つの価格で企業の支払意思を確かめることを提案しています。ただし、これはまだ提案で、責任者が価格を一本化するまで、社外に単価を伝えないでください。`);
  }

  // ---- Slide 14: コスト
  {
    const s = content("第4章｜ビジネスモデル", "サービス提供に必要なコスト");
    const costs = [
      [md.MdPerson, "スタッフの時間", "測定・説明・指導"],
      [md.MdDirectionsCar, "移動・交通", "企業までの往復"],
      [md.MdInventory, "準備・設営", "機器の運搬・清拭"],
      [md.MdEditNote, "記録・集計", "入力と照合"],
      [md.MdDescription, "報告", "集計レポート作成"],
      [md.MdShield, "保険", "訪問中の事故に備える"],
      [md.MdSecurity, "情報管理・道具", "安全な保管・既存ツール"],
      [md.MdElderly, "デイへの影響", "デイサービスの減収など"],
    ];
    for (const [i, [ic, h, d]] of costs.entries()) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 0.6 + col * 3.08, y = 1.65 + row * 1.75;
      card(s, x, y, 2.88, 1.55, i === 7 ? C.background1 : C.background2);
      if (i === 7) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.88, h: 1.55, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "highlight" });
      await iconCircle(s, ic, x + 0.18, y + 0.2, 0.62, i === 7 ? C.accent4 : C.text2);
      txt(s, h, { x: x + 0.92, y: y + 0.15, w: 1.9, h: 0.75, fontSize: 18, bold: true, color: C.text2, valign: "middle" });
      txt(s, d, { x: x + 0.2, y: y + 0.95, w: 2.6, h: 0.5, fontSize: 16 });
    }
    card(s, 0.6, 5.25, 12.13, 1.6, C.text2);
    txt(s, [
      { text: "人の時間が一番大きなコストです", options: { bold: true, fontSize: 20, breakLine: true } },
      { text: "例：20人の初回測定は、1人30分の個別枠だけで10時間。移動・準備・報告は別にかかります。既存の職員が対応する場合も、その時間を「0円」とはみなしません。", options: { fontSize: 18 } },
    ], { x: 0.9, y: 5.3, w: 11.6, h: 1.5, color: C.background1, valign: "middle", paraSpaceAfter: 4 });
    note(s, `
サービス提供に必要なコストです。8つに整理しました。スタッフの時間、移動・交通、機器の運搬や清拭などの準備、記録と集計、報告書の作成、訪問中の事故に備える保険、情報を安全に保管するための対策、そしてデイサービスへの影響です。
一番大きいのは人の時間です。現在の計画では初回を1人30分、再評価を1人20分としていますが、20人の初回測定は個別枠だけで10時間かかります。移動や準備、報告書づくりの時間は別です。
当面は新しく人を雇わず、既存のデイサービスの職員が兼務する方針です。そのため「追加の現金」はあまり増えませんが、その時間を0円とみなすと、本当の採算を見誤ります。監査でもこの点が最も重大な指摘の一つでした。
また、職員がデイサービスを抜けることによる減収などの影響も、コストとして考える必要があります。この影響額は、資料によって月3万円と、1開催日あたり5,000円という異なる仮定があり、まだ確定していません。`);
  }

  // ---- Slide 15: 財務計画
  {
    const s = content("第4章｜ビジネスモデル", "財務計画の見方：2つの物差しで結果が変わる");
    s.addChart(pres.charts.BAR, [
      { name: "会社の増分キャッシュフロー", labels: ["保守", "基準", "楽観（強気）"], values: [55.7, 733.2, 1415.8] },
      { name: "管理会計上の損益（職員の時間を費用に含む）", labels: ["保守", "基準", "楽観（強気）"], values: [-859.6, -342.8, 13.7] },
    ], {
      x: 0.6, y: 1.6, w: 7.2, h: 4.75, barDir: "col", barGrouping: "clustered",
      chartColors: [HEX.accent2, HEX.accent4],
      showTitle: true, title: "36か月の累計試算（2026年11月〜2029年10月、万円）", titleFontSize: 15, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0;▲#,##0",
      catAxisLabelFontSize: 16, catAxisLabelColor: HEX.dk1, catAxisLabelFontFace: "+mn-lt", catAxisLabelPos: "low",
      valAxisLabelFontSize: 12, valAxisLabelColor: GRAY, valAxisLabelFontFace: "+mn-lt", valAxisMinVal: -1000, valAxisMaxVal: 1600, valAxisMajorUnit: 500, valAxisLabelFormatCode: "#,##0;▲#,##0",
      valGridLine: { color: "D9E3EE", size: 0.75 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendFontSize: 14, legendFontFace: "+mn-lt", legendColor: HEX.dk1,
    });
    card(s, 8.1, 1.6, 4.63, 1.75);
    txt(s, [
      { text: "増分キャッシュフロー", options: { bold: true, color: C.accent2, breakLine: true, fontSize: 19 } },
      { text: "WPCを始めることで会社の現金がいくら増えるか。既存職員の給与は払い済みなので含めない", options: { fontSize: 16 } },
    ], { x: 8.3, y: 1.7, w: 4.3, h: 1.6 });
    card(s, 8.1, 3.5, 4.63, 1.75);
    txt(s, [
      { text: "管理会計上の損益", options: { bold: true, color: C.accent4, breakLine: true, fontSize: 19 } },
      { text: "職員がWPCに使った時間も人件費として計算した、事業そのものの損益", options: { fontSize: 16 } },
    ], { x: 8.3, y: 3.6, w: 4.3, h: 1.6 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.1, y: 5.4, w: 4.63, h: 0.95, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "caution" });
    tag(s, "試算", 8.25, 5.69, 0.85);
    txt(s, "実績ではありません。価格96万円（年4回40人）など未確定の仮定に基づきます", { x: 9.2, y: 5.4, w: 3.45, h: 0.95, fontSize: 14, valign: "middle" });
    txt(s, "基準ケースでは現金は増える試算でも、職員の時間を費用に含めると約343万円の赤字。どちらか一方だけを見て判断しないことが大切です。", { x: 0.6, y: 6.42, w: 12.13, h: 0.55, fontSize: 16, bold: true, color: C.text2 });
    note(s, `
財務計画の見方です。財務モデルVer.1.1では、保守・基準・楽観（モデル上の名称は「強気」）の3つのシナリオで、2026年11月から36か月間を試算しています。グラフは36か月の累計です。これは実績ではなく、まだ決まっていない価格や受注数を仮定した試算です。
同じ事業でも、2つの物差しで結果が大きく変わります。
青は「増分キャッシュフロー」です。WPCを始めることで会社の現金がいくら増えるかを見たもので、既存の職員の給与はもともと払っているので含めません。基準ケースでは約733万円の増加です。
オレンジは「管理会計上の損益」です。職員がWPCに使った時間も人件費として計算した、事業そのものの損益です。基準ケースでは約343万円の赤字、保守ケースでは約860万円の赤字で、黒字になるのは楽観ケースだけです。
この差、約1,076万円は、既存職員の時間の価値です。監査は、職員に本当に空き時間があるかを勤務表で確認するまで、現金の増加だけを判断材料にしないよう求めています。
なお、資金面では基準ケースで約29万円の準備資金が目安とされていますが、実際に使える資金や税金はまだ確認されていません。旧資料の336.7万円という必要資金とは前提が違う点にも注意してください。`);
  }

  // ============ 第5章 ============
  section("第5章 社員の役割と安全管理");
  // ---- Slide 16: 役割
  {
    const s = content("第5章｜社員の役割と安全管理", "社員は何をするのか：役割分担の仮案");
    const roles = [
      [md.MdHandshake, "営業", "本部との面談・見積"],
      [md.MdSchedule, "事前調整", "参加枠・会場・シフト"],
      [fa.FaPersonWalking, "測定", "PTが体調確認と測定"],
      [md.MdHealthAndSafety, "安全補助", "転倒防止・計時"],
      [md.MdEditNote, "記録", "入力と照合"],
      [md.MdAssessment, "報告", "集計・レポート"],
      [md.MdBadge, "事務", "予約・請求・連絡"],
    ];
    // center hub
    card(s, 4.97, 3.0, 3.4, 1.25, C.text2);
    txt(s, "開催1回の\nチーム", { x: 4.97, y: 3.0, w: 3.4, h: 1.25, fontSize: 20, bold: true, color: C.background1, align: "center", valign: "middle" });
    const pos = [[0.6, 1.65], [4.97, 1.65], [9.33, 1.65], [0.6, 3.0], [9.33, 3.0], [0.6, 4.35], [9.33, 4.35]];
    for (const [i, [ic, h, d]] of roles.entries()) {
      const [x, y] = pos[i];
      card(s, x, y, 3.4, 1.2);
      await iconCircle(s, ic, x + 0.17, y + 0.22, 0.75, i === 2 || i === 3 ? C.accent2 : C.text2);
      txt(s, h, { x: x + 1.1, y: y + 0.12, w: 2.2, h: 0.45, fontSize: 20, bold: true, color: C.text2 });
      txt(s, d, { x: x + 1.1, y: y + 0.58, w: 2.25, h: 0.5, fontSize: 16 });
    }
    card(s, 4.97, 4.35, 3.4, 1.2);
    txt(s, "測定1か所を「測定担当＋補助担当」の2名で行う案", { x: 5.1, y: 4.35, w: 3.15, h: 1.2, fontSize: 16, valign: "middle" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.75, w: 12.13, h: 1.1, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "caution" });
    tag(s, "仮案", 0.85, 6.12, 1.0);
    txt(s, "担当者・人数は未定です。資料ごとに「PT1人で1対1」「3名×7時間」「1列2名」と前提が異なり、決める必要があります。事業・安全・情報管理・統計の責任者もこれから任命します。", { x: 2.05, y: 5.78, w: 10.55, h: 1.05, fontSize: 16, valign: "middle" });
    note(s, `
社員の皆さんが担う役割です。開催1回をチームで動かすイメージで、7つの役割に分けました。
営業は本部との面談や見積、事前調整は参加枠や会場、シフトの調整です。当日は、PTが体調確認と測定を行い、別のスタッフが転倒防止や計時などの安全補助を担います。測定マニュアル案では、1つの測定列に測定担当と補助担当の2名を置く案になっています。終わった後は記録の入力と照合、集計レポートの作成、予約・請求・連絡などの事務があります。
ただし、これはすべて仮案です。誰が担当するか、何人で回すかは決まっていません。資料によって、PT1人で1対1、3名で7時間、1列2名と前提が違い、人数によって原価が2〜3倍変わります。
監査では、まず事業・安全・情報管理・統計の4つの責任者を任命することが求められています。皆さんに具体的な役割をお願いする際は、改めて業務量と勤務への影響を確認したうえでご相談します。`);
  }

  // ---- Slide 17: デイサービス
  {
    const s = content("第5章｜社員の役割と安全管理", "デイサービスとの関係：人員基準を守ることが最優先");
    // two circles overlap diagram
    s.addShape(pres.shapes.OVAL, { x: 0.8, y: 1.75, w: 4.0, h: 3.5, fill: { color: C.text2, transparency: 5 }, line: { type: "none" }, objectName: "day service" });
    s.addShape(pres.shapes.OVAL, { x: 3.5, y: 1.75, w: 4.0, h: 3.5, fill: { color: C.accent2, transparency: 25 }, line: { type: "none" }, objectName: "wpc" });
    txt(s, "デイサービス\n（既存事業）", { x: 1.0, y: 2.9, w: 2.3, h: 1.0, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "WPC\n（新規事業）", { x: 5.1, y: 2.9, w: 2.2, h: 1.0, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "同じ\n職員の\n時間", { x: 3.55, y: 2.75, w: 1.2, h: 1.4, fontSize: 17, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "職員がWPCで企業へ出かけると、デイサービスの配置が手薄になるおそれがあります", { x: 0.6, y: 5.35, w: 7.0, h: 0.95, fontSize: 17 });
    const chk = [
      ["人員基準・加算を守れるか", "要確認", "機能訓練指導員のPT等が抜けると加算を算定できないおそれ"],
      ["盛岡市（指定権者）へ照会", "未完了", "配置・加算の扱いを事前に確認する"],
      ["兼務時間を勤務表で確認", "未完了", "WPCには配置基準の外の職員・時間だけを充てる案"],
    ];
    for (const [i, [h, t, d]] of chk.entries()) {
      const y = 1.7 + i * 1.5;
      card(s, 7.9, y, 4.83, 1.3);
      txt(s, h, { x: 8.1, y: y + 0.1, w: 3.35, h: 0.55, fontSize: 18, bold: true, color: C.text2, valign: "middle" });
      tag(s, t, 11.55, y + 0.15, 1.05, t === "未完了" ? "accent6" : "accent4");
      txt(s, d, { x: 8.1, y: y + 0.68, w: 4.5, h: 0.55, fontSize: 15, color: C.text1 });
    }
    glossary(s, "人員基準＝介護保険の職員配置の決まり／加算＝要件を満たすと上乗せされる報酬／指定権者＝盛岡市", 6.42);
    note(s, `
デイサービスとの関係です。ここは事業の前提そのものに関わる、とても重要な点です。
WPCは当面、新しく人を雇わず、デイサービスの職員が兼務する計画です。つまり、デイサービスとWPCは「同じ職員の時間」を分け合うことになります。
デイサービスには、介護保険で定められた職員配置の決まり、「人員基準」があります。また、個別機能訓練加算などの「加算」には、機能訓練指導員のPT等が専らその仕事に従事する、といった要件があります。営業時間中にPTが企業へ出かけると、この要件を満たせず、加算が算定できなくなったり、運営指導で指摘や返還の対象になったりするおそれがあると、監査で指摘されました。
そのため、事業所の指定や指導を行う盛岡市、つまり指定権者への事前照会と、勤務表で実際に兼務できる時間の確認が必要ですが、どちらもまだ完了していません。監査は、WPCに充てるのは配置基準の外の職員や時間帯に限るべきと提案しています。
皆さんにお願いしたいのは、デイサービスの利用者さんと人員基準を最優先にすることです。WPCのためにデイサービスの配置を崩すことはしません。`);
  }

  // ---- Slide 18: 安全と個人情報
  {
    const s = content("第5章｜社員の役割と安全管理", "安全と個人情報を守る");
    const half = async (x, ic, h, items, foot) => {
      card(s, x, 1.65, 5.95, 4.35);
      await iconCircle(s, ic, x + 0.25, 1.82, 0.75);
      txt(s, h, { x: x + 1.15, y: 1.82, w: 4.6, h: 0.75, fontSize: 21, bold: true, color: C.text2, valign: "middle" });
      items.forEach((it, i) => {
        const yy = 2.72 + i * 0.66;
        txt(s, it[0], { x: x + 0.3, y: yy, w: 1.55, h: 0.6, fontSize: 17, bold: true, color: C.text2, valign: "middle" });
        txt(s, it[1], { x: x + 1.9, y: yy, w: 3.9, h: 0.6, fontSize: 16, valign: "middle" });
      });
      txt(s, foot, { x: x + 0.3, y: 5.38, w: 5.45, h: 0.55, fontSize: 14, color: C.accent4 });
    };
    await half(0.6, md.MdHealthAndSafety, "測定の安全", [
      ["事前確認", "当日の体調・痛み・めまいなどを確認"],
      ["中止基準", "痛み・胸の症状・息切れ・ふらつき、本人の希望ですぐ中止"],
      ["転倒防止", "補助者が支えられる位置に立ち、床と椅子を確認"],
      ["緊急時", "119番・AED・救急経路を拠点ごとに事前確認"],
    ], "数値の中止基準・救急連絡先・医療相談先は未記入で、承認前");
    await half(6.78, md.MdLock, "個人情報", [
      ["本人同意", "参加・健康情報・研究利用を分けて同意を得る"],
      ["企業へは集計", "個人の値は渡さない。10人未満は原則非表示"],
      ["目的外の利用", "人事評価・営業リストには使わない"],
      ["保管", "業務用の環境で、アクセス制限と多要素認証"],
    ], "健康データを個人PCのExcelに保存している点は移行が必要");
    glossary(s, "要配慮個人情報＝病歴など、取り扱いに特に配慮が必要な個人情報。取得には原則として本人の同意が必要", 6.42);
    note(s, `
安全と個人情報についてです。
まず測定の安全です。測定前に当日の体調、痛み、めまいなどを確認します。測定中に痛み、胸の症状、強い息切れ、ふらつきがあった場合や、本人が希望した場合はすぐに中止します。転倒を防ぐため、補助者が支えられる位置に立ち、滑りにくい床や固定した椅子を使います。緊急時に備えて、119番、AED、救急の経路を拠点ごとに事前に確認します。
ただし、血圧などの数値による中止基準、救急連絡先、医療相談先はまだ空欄で、安全責任者の承認も得ていません。これがそろうまで現場での実施はしません。
次に個人情報です。病歴など取り扱いに特に配慮が必要な情報は「要配慮個人情報」と呼ばれ、取得には原則として本人の同意が必要です。参加、健康情報の取得、研究への利用は分けて同意を得ます。企業へは集計のみで、10人未満の集団は原則表示しません。人事評価や営業リストには使いません。
監査では、健康データのExcelを個人のパソコンに保存している点が指摘されました。業務用の環境へ移し、アクセス制限と多要素認証を必須にします。`);
  }

  // ============ 第6章 ============
  section("第6章 今後の展開");
  // ---- Slide 19: 進捗
  {
    const s = content("第6章｜今後の展開", "現在の進捗：どこまでできていて、何が残っているか");
    const cols = [
      { h: "作成済み（未承認を含む）", k: "accent5", ic: md.MdCheckCircle, items: ["事業計画書 第4版", "財務モデル Ver.1.1（試算）", "KPI定義書・測定手順（案）", "競合・地域の公開情報調査", "独立第三者監査の実施"] },
      { h: "設計中", k: "accent2", ic: md.MdConstruction, items: ["価格・回数・体制の一本化", "測定項目の確定と模擬測定", "安全手順・救急体制", "同意書・個人情報の規程", "契約書雛形・Excel修正"] },
      { h: "未検証", k: "accent4", ic: md.MdHelp, items: ["企業の支払意思", "1人30分・20分で回るか", "身体機能・腰痛・生産性への効果", "デイサービスとの兼務時間", "保険の条件と費用"] },
    ];
    for (const [i, c] of cols.entries()) {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.65, 3.88, 4.65);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.65, w: 3.88, h: 0.85, fill: { color: C[c.k] }, line: { type: "none" }, rectRadius: 0.12, objectName: "col head" });
      s.addImage({ data: await icon(c.ic, HEX.lt1), x: x + 0.2, y: 1.8, w: 0.55, h: 0.55, altText: c.h });
      txt(s, c.h, { x: x + 0.85, y: 1.65, w: 2.95, h: 0.85, fontSize: c.h.length > 8 ? 17 : 21, bold: true, color: C.background1, valign: "middle" });
      txt(s, bullets(c.items), { x: x + 0.25, y: 2.7, w: 3.5, h: 3.0, fontSize: 18, paraSpaceAfter: 10 });
      if (i === 0) txt(s, "KPI＝事業が順調かを確認するための指標", { x: x + 0.25, y: 5.75, w: 3.5, h: 0.45, fontSize: 14, color: GRAY });
    }
    txt(s, "面談・見積・発注は0件。商談・契約・測定・効果検証はまだ完了していません（11月4日時点）", { x: 0.6, y: 6.45, w: 12.13, h: 0.5, fontSize: 17, bold: true, color: C.text2 });
    note(s, `
現在の進捗を3つに分けました。
「作成済み」は、事業計画書第4版、財務モデルVer.1.1、KPI定義書と測定マニュアルの案、競合や地域の公開情報調査、そして独立第三者監査です。ただし、KPI定義書と測定マニュアルは承認前の案で、財務モデルも試算です。KPIとは、事業が順調かを確認するための指標のことです。
「設計中」は、価格・回数・体制の一本化、測定項目の確定と模擬測定、安全手順と救急体制、同意書と個人情報の規程、契約書の雛形、集計用Excelの不具合修正です。
「未検証」は、企業が本当にお金を払うか、1人30分・20分で本当に回るか、身体機能や腰痛、生産性への効果、デイサービスとの兼務時間、保険の条件です。
まとめると、資料づくりはかなり進みましたが、商談、契約、測定、効果検証は、まだどれも完了していません。`);
  }

  // ---- Slide 20: 監査の課題
  {
    const s = content("第6章｜今後の展開", "第三者監査で分かった、開始前に解決すべき課題");
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.6, w: 12.13, h: 0.85, fill: { color: C.text2 }, line: { type: "none" }, rectRadius: 0.12, objectName: "verdict" });
    txt(s, [
      { text: "総合判定：条件付きで進めてよい。", options: { bold: true } },
      { text: "ただし今の計画のままの開始は不可（No-Go）" },
    ], { x: 0.85, y: 1.6, w: 11.7, h: 0.85, fontSize: 19, color: C.background1, valign: "middle" });
    const issues = [
      [md.MdPayments, "価格・採算", "価格案が3つ並存。3,000円では構造的に赤字。採算が職員の時間をほぼ無償とみなす前提に依存"],
      [md.MdElderly, "人員基準", "PT等の兼務で、デイサービスの人員基準・加算の要件を満たせなくなるおそれ"],
      [md.MdHealthAndSafety, "測定の安全性・妥当性", "転倒リスクのある測定、救急体制が未記入。ほぼ全員成功して差が出ない項目がある"],
      [md.MdLock, "個人情報管理", "情報の預かり方の法的な構造が未確定。健康データを個人PCに保存"],
    ];
    for (const [i, [ic, h, d]] of issues.entries()) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 2.65 + row * 1.85;
      card(s, x, y, 5.96, 1.65);
      await iconCircle(s, ic, x + 0.2, y + 0.25, 0.75, row === 0 ? C.accent6 : C.accent4);
      txt(s, h, { x: x + 1.1, y: y + 0.12, w: 4.7, h: 0.45, fontSize: 20, bold: true, color: C.text2 });
      txt(s, d, { x: x + 1.1, y: y + 0.58, w: 4.75, h: 1.0, fontSize: 16 });
    }
    card(s, 0.6, 6.22, 12.13, 0.76, C.background2);
    txt(s, [
      { text: "開始の条件　", options: { bold: true, color: C.accent2 } },
      { text: "監査が示す10の必須条件（C1〜C10：価格の一本化・兼務時間の確認・安全手順・同意書など）を満たした後に、1法人・40人以下・原価を回収できる価格・体組成計なしで開始" },
    ], { x: 0.8, y: 6.22, w: 11.8, h: 0.76, fontSize: 15, valign: "middle" });
    note(s, `
2026年11月4日に、独立した第三者による監査を受けました。総合判定は「条件付きで進めてよい」。ただし「今の計画のままで有料パイロットを始めるのは不可」、つまりNo-Goです。No-Goとは、進めてはいけない、という判定です。
課題は大きく4つに集約できます。
1つ目は価格と採算です。価格案が3つ並んでいて、3,000円では構造的に赤字になります。また採算は、既存職員の時間をほぼ無償とみなす前提に依存しています。
2つ目は人員基準です。PT等の兼務で、デイサービスの人員基準や加算の要件を満たせなくなるおそれがあります。
3つ目は測定の安全性と妥当性です。転倒リスクを伴う測定があるのに、救急体制が未記入です。また、ほぼ全員が成功して差が出ない測定項目もあります。
4つ目は個人情報管理です。情報をどういう法的な立場で預かるかが決まっておらず、健康データを個人のパソコンに保存しています。
このほか監査は、企業の支払意思を示す証拠（面談・見積・発注）が0件であることや、地域に無料の公的支援があることも、最も重い課題の一つに挙げています。
監査は、価格の一本化、兼務時間の確認、安全手順、個人情報、保険、契約書など、C1からC10の10個の必須条件を示しています。これをすべて満たしてから、1法人・40人以下・原価を回収できる価格で、体組成計InBodyを除き、研究ではないサービス評価として（研究にする場合は倫理審査を得て）、絞り込んだパイロットを始める、というのが監査の結論です。特にC1の価格、C2の兼務時間と介護保険の基準、C4の安全手順、C5の個人情報のどれかが未了なら、開始日を延期します。`);
  }

  // ---- Slide 21: 90日
  {
    const s = content("第6章｜今後の展開", "これから90日間の計画（案）");
    const X0 = 3.95, X1 = 12.73, DAYS = 90, dx = (X1 - X0) / DAYS;
    const dayX = (d) => X0 + (d - 1) * dx;
    // month headers: Day1=11/9; Dec1=Day23, Jan1=Day54, Feb1=Day85
    const months = [["11月", 1, 22], ["12月", 23, 53], ["1月", 54, 84], ["2月", 85, 90]];
    for (const [m, a, b] of months) {
      s.addShape(pres.shapes.RECTANGLE, { x: dayX(a), y: 1.6, w: (b - a + 1) * dx, h: 0.45, fill: { color: C.text2 }, line: { color: HEX.lt1, width: 1 }, objectName: "month" });
      txt(s, m, { x: dayX(a), y: 1.6, w: (b - a + 1) * dx, h: 0.45, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    }
    const rows = [
      ["① 準備", "責任者任命・価格統一・照会", 1, 14, "11/9–11/22"],
      ["② 顧客面談", "8〜10法人・1業種に集中", 8, 45, "11/16–12/23"],
      ["③ 模擬測定", "職員等10名・規程整備", 15, 35, "11/23–12/13"],
      ["④ 開始条件の確認", "C1〜C10を会議で照合", 36, 50, "12/14–12/28"],
      ["⑤ 有料パイロット", "1法人・40人以下で初回測定", 51, 75, "12/29–1/22"],
      ["⑥ 中間判定", "続行・改修・中止を判断", 76, 90, "1/23–2/6"],
    ];
    const RH = 0.68;
    for (const [i, [h, d, a, b, dates]] of rows.entries()) {
      const y = 2.15 + i * RH;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y, w: X1 - 0.6, h: RH, fill: { color: i % 2 ? C.background1 : C.background2 }, line: { type: "none" }, objectName: "row" });
      txt(s, h, { x: 0.7, y: y + 0.03, w: 3.2, h: 0.36, fontSize: 18, bold: true, color: C.text2 });
      txt(s, d, { x: 0.7, y: y + 0.38, w: 3.2, h: 0.28, fontSize: 13, color: GRAY });
      const col = i === 3 ? C.accent4 : i === 4 ? C.accent2 : C.text2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: dayX(a), y: y + 0.12, w: (b - a + 1) * dx, h: RH - 0.24, fill: { color: col }, line: { type: "none" }, rectRadius: 0.08, objectName: "bar " + h });
      txt(s, dates, { x: dayX(a), y: y + 0.12, w: (b - a + 1) * dx, h: RH - 0.24, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle" });
    }
    // gate line before day 51
    const gx = dayX(51);
    s.addShape(pres.shapes.LINE, { x: gx, y: 2.1, w: 0, h: RH * 6 + 0.1, line: { color: HEX.accent6, width: 2, dashType: "dash" } });
    txt(s, "関門：④を満たさなければ⑤は延期", { x: gx - 4.75, y: 2.15 + 5 * RH + 0.12, w: 4.65, h: RH - 0.24, fontSize: 15, bold: true, color: C.accent6, align: "right" });
    txt(s, [
      { text: "Day1＝2026年11月9日とした監査の提案日程。担当者は未定。", options: { breakLine: true } },
      { text: "年末年始と重なるため実際の日程は要調整。再測定は約3か月後（Day140前後）。" },
    ], { x: 0.6, y: 6.3, w: 12.13, h: 0.7, fontSize: 14, color: GRAY });
    note(s, `
これから90日間の計画案です。監査報告書が示した日程で、Day1を2026年11月9日としています。担当者はまだ決まっていません。
①準備では、事業・安全・情報管理・統計の責任者を任命し、価格などの版を一本化し、勤務表で兼務できる時間を確認し、盛岡市への照会と保険の見積を行います。
②顧客面談は、1つの業種に絞って8〜10法人の決裁者と面談し、3つの価格を示して見積を3件出すことを目指します。
③模擬測定では、職員や知人など10名で測定を試し、1人あたりの時間や、全員が満点になってしまう項目がないかを確認します。同時に、同意書や規程、契約書の雛形も整えます。
④開始条件の確認では、C1からC10の証拠を会議で照合します。赤い点線が関門で、ここを満たさなければ⑤の有料パイロットは延期します。
⑤有料パイロットは1法人・40人以下で初回測定を行い、⑥中間判定で、続けるか、直すか、やめるかを判断します。効果を見るための再測定は約3か月後、Day140前後です。
なお、この日程は年末年始と重なるため、実際にはずれる可能性が高いです。日程よりも、条件を満たすことを優先します。`);
  }

  // ---- Slide 22: 将来展望
  {
    const s = content("第6章｜今後の展開", "将来の展望：結果を見ながら一段ずつ");
    const steps = [
      ["1", "パイロットで確かめる", "安全・時間・原価・企業の支払意思"],
      ["2", "サービスを改善する", "価格・測定項目・体制を実測で見直す"],
      ["3", "同じ企業の別拠点へ", "本部一括の契約で拠点を広げる"],
      ["4", "Office Trainingとの連携", "結果の振り返り後に任意で別提案"],
    ];
    for (const [i, [n, h, d]] of steps.entries()) {
      const x = 0.6 + i * 3.08, y = 3.95 - i * 0.7, hh = 2.25 + i * 0.7;
      card(s, x, y, 2.9, hh, i === 0 ? C.text2 : C.background2);
      txt(s, n, { x: x + 0.2, y: y + 0.12, w: 0.8, h: 0.7, fontSize: 32, bold: true, color: i === 0 ? C.background1 : C.accent2 });
      txt(s, h, { x: x + 0.2, y: y + 0.8, w: 2.6, h: 0.75, fontSize: i === 3 ? 16 : 18, bold: true, color: i === 0 ? C.background1 : C.text2 });
      txt(s, d, { x: x + 0.2, y: y + 1.55, w: 2.6, h: 0.65, fontSize: 15, color: i === 0 ? C.background1 : C.text1 });
    }
    txt(s, "今ここ", { x: 0.6, y: 3.5, w: 2.9, h: 0.4, fontSize: 18, bold: true, color: C.accent2, align: "center" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 6.35, w: 12.13, h: 0.62, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.5 }, rectRadius: 0.12, objectName: "caution" });
    tag(s, "未確定", 0.8, 6.48, 1.2);
    txt(s, "2〜4はすべて構想です。東北6県への展開などの拡大目標は、時期・人員・投資が決まっていません", { x: 2.15, y: 6.35, w: 10.45, h: 0.62, fontSize: 16, valign: "middle" });
    note(s, `
将来の展望です。階段のように、一段ずつ確かめながら進みます。
今いるのは1段目、パイロットで確かめる段階です。安全に実施できるか、1人あたりの時間と原価、企業が本当にお金を払うかを確認します。
2段目は、その実測結果をもとに、価格、測定項目、体制を見直します。
3段目は、同じ企業の別の拠点へ、本部一括の契約で広げることです。
4段目は、当社の法人向けサービスであるOffice Trainingとの連携です。WPCの結果を振り返ったうえで、任意の別提案として紹介する形を考えています。WPCの購入条件にはしません。監査では、WPCをOffice Trainingの入口となる導入診断として位置付け、企業単位で採算を考える案も示されています。
2段目から4段目は、すべて構想です。産業保健部門として東北6県への展開という経営目標もありますが、時期、人員、投資は決まっていません。確定した計画として社外に話さないようにお願いします。`);
  }

  // ---- Slide 23: 伝えたいこと
  {
    const s = content("第6章｜今後の展開", "社員の皆さんに伝えたいこと");
    const blocks = [
      { ic: md.MdLightbulb, h: "実現したい価値", k: "accent2", items: ["働く人に自分の体を知ってもらう", "安全に長く働ける職場を、PTの専門性で支える"] },
      { ic: md.MdHandshake, h: "お願いしたいこと", k: "text2", items: ["デイの利用者と基準を最優先", "模擬測定・勤務表確認に協力", "気づいたリスクは早めに報告", "社外で「効果がある」「契約済み」と言わない"] },
      { ic: md.MdFlag, h: "今の課題", k: "accent4", items: ["価格の一本化", "兼務と人員基準の確認", "安全手順の承認", "個人情報の扱いの確定"] },
    ];
    for (const [i, b] of blocks.entries()) {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.65, 3.88, 4.7);
      await iconCircle(s, b.ic, x + 0.25, 1.85, 0.8, C[b.k]);
      txt(s, b.h, { x: x + 1.2, y: 1.85, w: 2.6, h: 0.8, fontSize: 21, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(b.items), { x: x + 0.2, y: 2.85, w: 3.6, h: 3.5, fontSize: 18, paraSpaceAfter: 10 });
    }
    txt(s, "急がず、確かめながら進めます。疑問や心配は遠慮なく聞いてください。", { x: 0.6, y: 6.55, w: 12.13, h: 0.42, fontSize: 18, bold: true, color: C.text2, align: "center" });
    note(s, `
最後に、皆さんに伝えたいことです。
WPCで実現したいのは、働く人が自分の体の状態を知り、安全に、長く働ける職場づくりを、理学療法士の専門性で支えることです。デイサービスで培ってきた力を、地域の企業で働く人にも届けたいと考えています。
皆さんへのお願いは4つです。1つ目、デイサービスの利用者さんと人員基準を最優先にしてください。2つ目、模擬測定や勤務表の確認にご協力ください。3つ目、安全や個人情報で気になることがあれば、早めに報告してください。4つ目、社外では「効果がある」「契約が決まっている」といった言い方をしないでください。
今の課題は、価格の一本化、兼務と人員基準の確認、安全手順の承認、個人情報の扱いの確定です。
急がず、確かめながら進めます。疑問や心配は遠慮なく聞いてください。`);
  }

  // ---- Slide 24: Q&A
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: curSection });
    s.addText("質疑応答", { placeholder: "title" });
    s.addText("ご質問・ご意見をお聞かせください", { placeholder: "body" });
    card(s, 0.8, 5.25, 11.7, 1.4, C.accent1);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 5.25, w: 11.7, h: 1.4, fill: { color: C.background1, transparency: 88 }, line: { color: C.accent3, width: 1 }, rectRadius: 0.12, objectName: "faq box" });
    txt(s, [
      { text: "よくある質問の例", options: { bold: true, breakLine: true } },
      { text: "「いつから始まる？」→ 開始条件C1〜C10を満たしてから。日付は未定　／　「誰が担当する？」→ 未定。勤務への影響を確認して相談します" },
    ], { x: 1.1, y: 5.3, w: 11.1, h: 1.3, fontSize: 17, color: C.background1, valign: "middle" });
    note(s, `
ご清聴ありがとうございました。ここからは質疑応答の時間です。
想定される質問に先にお答えしておきます。
「いつから始まるのか」――監査が示した開始条件C1からC10を満たしてからです。具体的な開始日はまだ決まっていません。
「誰が担当するのか」――まだ決まっていません。デイサービスの勤務への影響を確認したうえで、個別にご相談します。
「デイサービスの仕事は増えるのか」――デイサービスの人員基準を守ることが前提です。兼務できる時間を勤務表で確認し、無理のない範囲で計画します。
「本当に効果があるのか」――まだ分かりません。パイロットでは、まず安全に実施できるか、時間や費用、企業の支払意思を確かめます。効果は長期的な検証課題です。
その他、何でもご質問ください。この場で答えられないことは、確認して後日お答えします。`);
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
