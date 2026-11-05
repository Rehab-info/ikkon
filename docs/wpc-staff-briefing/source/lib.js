// 共通ヘルパー（WPC社員向け説明資料 v2）
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

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
const GRID = "D9E3EE";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
pres.title = "WPC事業｜Buddyshipが目指す新しい産業保健サービス";
pres.author = "株式会社Buddyship";
pres.company = "株式会社Buddyship";
pres.subject = "社員向け事業説明資料";
const C = pres.SchemeColor;

const CHAPTERS = ["なぜ", "サービス", "測定・KPI", "市場・営業", "お金", "体制・安全", "これから"];
const FOOT = "WPC事業 社員向け説明資料 v2.2｜社内限り｜数値はすべて計画上の仮定・試算（実績ではありません）";

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "chap", type: "body", x: 0.6, y: 0.22, w: 7.5, h: 0.38, fontSize: 14, bold: true, color: C.accent2, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.6, w: 12.13, h: 0.85, fontSize: 30, bold: true, color: C.text2, margin: 0, valign: "middle", align: "left" }, text: "" } },
    { text: { text: FOOT, options: { x: 0.6, y: 7.05, w: 10.5, h: 0.3, fontSize: 10, color: GRAY, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: GRAY, align: "right" },
});
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.7, w: 11.7, h: 2.1, fontSize: 40, bold: true, color: C.background1, margin: 0, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.0, w: 11.7, h: 0.8, fontSize: 22, color: C.accent3, margin: 0, valign: "top" }, text: "" } },
  ],
});

const iconCache = {};
async function icon(Comp, hex, size = 256) {
  const key = Comp.name + hex;
  if (iconCache[key]) return iconCache[key];
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return (iconCache[key] = "image/png;base64," + buf.toString("base64"));
}
async function svgPng(svg) {
  const b = await sharp(Buffer.from(svg)).resize(400, 400).png().toBuffer();
  return "image/png;base64," + b.toString("base64");
}

let curSection = "";
function section(t) { curSection = t; pres.addSection({ title: t }); }

const TAGC = { 確定: "accent5", 作成済み: "accent5", 未完了: "accent6", "No-Go": "accent6", 重大: "accent6" };
function tag(s, text, x, y, w, kind) {
  const k = kind || TAGC[text] || "accent4";
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.36, fill: { color: C[k] || k }, line: { type: "none" }, rectRadius: 0.18, objectName: "tag " + text });
  s.addText(text, { x, y, w, h: 0.36, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
function content(chapNo, title) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: curSection });
  s.addText(typeof chapNo === "string" ? chapNo : chapNo ? `第${chapNo}章｜${CHAPTERS[chapNo - 1]}` : "はじめに", { placeholder: "chap" });
  s.addText(title, { placeholder: "title" });
  // 章の進行インジケーター
  const x0 = 8.35;
  CHAPTERS.forEach((c, i) => {
    const on = i + 1 === chapNo;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x0 + i * 0.63, y: 0.24, w: 0.58, h: 0.32, fill: { color: on ? C.text2 : C.background2 }, line: { type: "none" }, rectRadius: 0.16, objectName: "progress " + (i + 1) });
    s.addText(String(i + 1), { x: x0 + i * 0.63, y: 0.24, w: 0.58, h: 0.32, fontSize: 12, bold: true, color: on ? C.background1 : C.accent2, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  return s;
}
function card(s, x, y, w, h, fill, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill || C.background2 }, line: { type: "none" }, rectRadius: 0.12, objectName: name || "card" });
}
function frame(s, x, y, w, h, lineColor, dash) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: C.background1 }, line: { color: lineColor || C.accent4, width: 1.5, dashType: dash || "solid" }, rectRadius: 0.12, objectName: "frame" });
}
function txt(s, text, o) {
  s.addText(text, Object.assign({ fontSize: 18, color: C.text1, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 }, o));
}
async function iconCircle(s, Comp, x, y, d, bg, fg) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg || C.text2 }, line: { type: "none" }, objectName: "icon circle" });
  const pad = d * 0.22;
  s.addImage({ data: await icon(Comp, fg || HEX.lt1), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: "アイコン" });
}
function bullets(items) {
  return items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1 } }));
}
function note(s, t) { s.addNotes(t.trim()); }
function glossary(s, text, y = 6.45) {
  card(s, 0.6, y, 12.13, 0.5, C.background2, "glossary");
  txt(s, [{ text: "用語　", options: { bold: true, color: C.accent2 } }, { text }], { x: 0.8, y, w: 11.8, h: 0.5, fontSize: 15, valign: "middle" });
}
function caution(s, label, text, y, h = 0.75, opts = {}) {
  frame(s, 0.6, y, 12.13, h, opts.line || C.accent4);
  tag(s, label, 0.8, y + (h - 0.36) / 2, opts.tw || 1.2, opts.kind);
  txt(s, text, { x: 0.8 + (opts.tw || 1.2) + 0.25, y, w: 12.13 - (opts.tw || 1.2) - 0.65, h, fontSize: opts.fs || 17, valign: "middle" });
}
function arrowR(s, x, y, w, h, color) {
  s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h, fill: { color: color || C.accent3 }, line: { type: "none" }, objectName: "arrow" });
}
function chartBase(extra) {
  return Object.assign({
    titleFontSize: 15, titleColor: HEX.dk2, titleFontFace: "+mn-lt", showTitle: true,
    dataLabelFontSize: 14, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
    catAxisLabelFontSize: 15, catAxisLabelColor: HEX.dk1, catAxisLabelFontFace: "+mn-lt",
    valAxisLabelFontSize: 12, valAxisLabelColor: GRAY, valAxisLabelFontFace: "+mn-lt",
    valGridLine: { color: GRID, size: 0.75 }, catGridLine: { style: "none" },
    legendFontSize: 14, legendFontFace: "+mn-lt", legendColor: HEX.dk1,
  }, extra);
}

module.exports = { pres, C, HEX, GRAY, GRID, THEME, CHAPTERS, icon, svgPng, section, tag, content, card, frame, txt, iconCircle, bullets, note, glossary, caution, arrowR, chartBase, get curSection() { return curSection; } };
