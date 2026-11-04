// はじめに〜第3章
const md = require("react-icons/md");
const fa = require("react-icons/fa6");
const FIGS = require("./figs.js");
const L = require("./lib.js");
const { pres, C, HEX, GRAY, section, tag, content, card, frame, txt, iconCircle, bullets, note, glossary, caution, arrowR, chartBase, svgPng, icon } = L;

module.exports = async function () {
  // ===== はじめに =====
  section("はじめに");
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: L.curSection });
    s.addText("WPC事業｜Buddyshipが目指す\n新しい産業保健サービス", { placeholder: "title" });
    s.addText("社員向け事業説明会　2026年11月　株式会社Buddyship", { placeholder: "body" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 5.2, w: 11.7, h: 1.15, fill: { color: C.background1, transparency: 88 }, line: { color: C.accent3, width: 1 }, rectRadius: 0.12, objectName: "caution box" });
    txt(s, [
      { text: "この資料の読み方　", options: { bold: true } },
      { text: "WPCは準備段階の新規事業です。金額・人数・効果はすべて計画上の仮定や試算で、契約・実績・実証済みの効果ではありません。" },
    ], { x: 1.1, y: 5.2, w: 11.1, h: 1.15, valign: "middle", color: C.background1 });
    txt(s, "産業保健：働く人の健康と安全を職場で守る取り組み", { x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontSize: 15, color: C.accent3 });
    note(s, `
皆さん、お疲れさまです。今日は当社が準備している新規事業「WPC」の事業計画の全体を、約40分でご説明します。
WPCは、企業で働く方の体の動きを理学療法士が測り、一人ひとりに合った運動を支援し、企業には個人が分からない集計結果を報告する、法人向けの「産業保健サービス」です。産業保健とは、働く人の健康と安全を職場で守る取り組みのことです。
最初にお伝えしたいのは、WPCはまだ準備段階だということです。今日出てくる金額や人数はすべて計画上の仮定や試算で、契約した企業はまだなく、効果も実証されていません。「決まっていること」と「まだ決まっていないこと」を区別しながら聞いてください。`);
  }

  // ---- 目次・凡例
  {
    const s = content(0, "今日の流れと、資料の見方");
    const parts = [
      ["1", "なぜ始めるのか", "職場の課題と、WPCが目指す2つの柱"],
      ["2", "どんなサービスか", "年間の流れ・1回の測定日・運動支援"],
      ["3", "何を測り、どう報告するか", "測定項目・KPI・企業レポート"],
      ["4", "誰に売るのか", "対象業種・競合・営業の進め方"],
      ["5", "お金の話", "価格・原価・3年間の試算"],
      ["6", "体制と安全", "人員・デイサービス・個人情報"],
      ["7", "これから", "進捗・監査・開始までの関門・90日計画"],
    ];
    parts.forEach(([n, h, d], i) => {
      const y = 1.62 + i * 0.66;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.04, w: 0.52, h: 0.52, fill: { color: C.text2 }, line: { type: "none" }, objectName: "num" });
      txt(s, n, { x: 0.6, y: y + 0.04, w: 0.52, h: 0.52, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
      txt(s, h, { x: 1.3, y, w: 3.4, h: 0.6, fontSize: 19, bold: true, color: C.text2, valign: "middle" });
      txt(s, d, { x: 4.65, y, w: 3.75, h: 0.6, fontSize: 14, color: GRAY, valign: "middle" });
    });
    card(s, 8.55, 1.62, 4.18, 4.55);
    txt(s, "資料中のラベルの意味", { x: 8.8, y: 1.75, w: 3.8, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    const legend = [["確定", "accent5", "方針として決まっている"], ["案", "accent4", "提案中・承認前"], ["試算", "accent4", "仮定に基づく計算"], ["未確定", "accent4", "資料間で食い違う／未決"], ["未完了", "accent6", "開始前に必ず終える作業"]];
    legend.forEach(([t, k, d], i) => {
      const y = 2.3 + i * 0.66;
      tag(s, t, 8.8, y + 0.07, 1.1, k);
      txt(s, d, { x: 10.05, y, w: 2.6, h: 0.5, fontSize: 15, valign: "middle" });
    });
    txt(s, "所要時間：約40分＋質疑応答", { x: 8.8, y: 5.7, w: 3.8, h: 0.4, fontSize: 15, color: GRAY });
    txt(s, "根拠資料：事業計画書 第4版（正本）を最優先し、2026年11月4日の第三者監査報告書と、KPI定義書・測定プロトコル・現場SOP・財務モデル等の案を反映", { x: 0.6, y: 6.3, w: 12.13, h: 0.65, fontSize: 14, color: GRAY });
    note(s, `
今日の流れです。7つの章で、なぜ始めるのか、どんなサービスか、何を測ってどう報告するか、誰に売るのか、お金、体制と安全、これからの予定、の順にお話しします。右上の数字は、今どの章にいるかを示しています。
資料の中には色付きのラベルがあります。緑の「確定」は方針として決まっていること、オレンジの「案」「試算」「未確定」はまだ決まっていないこと、赤の「未完了」は開始前に必ず終えなければならない作業です。
根拠は、事業計画書第4版を正本として最優先し、11月4日の第三者監査報告書の指摘を反映しています。資料同士で数字が違う場合は、都合のよい方を選ばず、両方を示して「未確定」としています。`);
  }

  // ---- 1枚でわかるWPC
  {
    const s = content(0, "1枚でわかるWPC");
    const boxes = [
      [md.MdHealthAndSafety, "何をする？", "理学療法士が企業を訪問し、従業員の体の動きを測って運動を支援。企業には集計を報告"],
      [md.MdFlag, "目的は？", "転倒・腰痛の予防と、生産性の向上。この2つを同じ重さの柱とする"],
      [md.MdBusiness, "誰に？", "盛岡と周辺の企業。食品製造・物流倉庫・ホテル・製造業を優先し、小売も並行"],
      [md.MdPayments, "どう稼ぐ？", "企業が年間契約の料金を払う。価格は3案あり未確定"],
      [md.MdHourglassBottom, "今どこ？", "計画書や手順の案はほぼできた段階。面談・契約・測定は0件"],
      [md.MdDirectionsRun, "次は？", "開始条件を満たしてから、1つの企業で小さく有料パイロット"],
    ];
    for (const [i, [ic, h, d]] of boxes.entries()) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * 4.12, y = 1.62 + row * 2.45;
      card(s, x, y, 3.88, 2.25, i === 4 ? C.text2 : C.background2);
      await iconCircle(s, ic, x + 0.22, y + 0.22, 0.72, i === 4 ? C.accent2 : C.text2);
      txt(s, h, { x: x + 1.1, y: y + 0.22, w: 2.6, h: 0.72, fontSize: 21, bold: true, color: i === 4 ? C.background1 : C.text2, valign: "middle" });
      txt(s, d, { x: x + 0.25, y: y + 1.05, w: 3.45, h: 1.15, fontSize: 17, color: i === 4 ? C.background1 : C.text1 });
    }
    caution(s, "監査判定", "条件付きで進めてよい。ただし今の計画のままの開始は不可（No-Go）", 6.43, 0.55, { tw: 1.4, fs: 16 });
    note(s, `
最初に、WPCを1枚でまとめます。
何をするか。理学療法士が企業を訪問し、従業員の体の動きを測り、その人に合った運動を支援し、企業には個人が分からない集計を報告します。
目的は、転倒・腰痛の予防と生産性の向上で、この2つを同じ重さの柱としています。
対象は盛岡と周辺の企業で、食品製造、物流倉庫、ホテル、製造業を優先し、スーパーなどの小売も並行して当たります。
収益は企業からの年間契約の料金ですが、価格は資料によって3つの案があり、まだ決まっていません。
今の段階は、計画書や手順書の案がほぼそろったところで、面談・契約・測定はまだ0件です。
次の一歩は、開始条件をすべて満たしてから、1つの企業で小さく有料パイロットを行うことです。下にあるとおり、第三者監査は「今の計画のままの開始は不可」と判定しています。この後、その理由も含めて順にご説明します。`);
  }

  // ===== 第1章 =====
  section("第1章 なぜ始めるのか");
  {
    const s = content(1, "職場の身体的な負担が、従業員と企業に影響している");
    const cols = [
      { x: 0.6, ic: md.MdEngineering, h: "職場の課題", items: ["長時間の立ち作業", "重い物の持ち上げ", "中腰・くり返し動作", "滑りやすい床・段差"] },
      { x: 4.9, ic: fa.FaPersonFalling, h: "従業員への影響", items: ["腰痛など体の痛み", "転倒・つまずき", "疲れやすさ・動きにくさ"] },
      { x: 9.2, ic: md.MdBusiness, h: "企業への影響\n（起こりうること）", items: ["休業を伴う労働災害", "プレゼンティーイズム", "戦力の低下"] },
    ];
    for (const [i, c] of cols.entries()) {
      card(s, c.x, 1.62, 3.53, 3.4);
      await iconCircle(s, c.ic, c.x + 0.25, 1.8, 0.75);
      txt(s, c.h, { x: c.x + 1.1, y: 1.8, w: 2.35, h: 0.75, fontSize: i === 2 ? 17 : 19, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(c.items), { x: c.x + 0.2, y: 2.75, w: 3.25, h: 2.2 });
      if (i < 2) arrowR(s, c.x + 3.6, 3.0, 0.62, 0.6);
    }
    frame(s, 0.6, 5.2, 12.13, 1.0, C.accent3);
    txt(s, [{ text: "37,195人", options: { fontSize: 30, bold: true, color: C.text2 } }, { text: "　転倒", options: { fontSize: 18 } }], { x: 0.85, y: 5.2, w: 3.3, h: 1.0, valign: "middle" });
    txt(s, [{ text: "22,166人", options: { fontSize: 30, bold: true, color: C.text2 } }, { text: "　動作の反動・無理な動作", options: { fontSize: 16 } }], { x: 4.0, y: 5.2, w: 4.8, h: 1.0, valign: "middle" });
    txt(s, "2025年・全国・全業種の休業4日以上の労働災害（厚生労働省）。盛岡の企業の実態やWPCの効果を示す数字ではありません", { x: 8.8, y: 5.2, w: 3.8, h: 1.0, fontSize: 13, color: GRAY, valign: "middle" });
    glossary(s, "プレゼンティーイズム＝出勤していても、健康上の問題で仕事の能力を十分に発揮できない状態", 6.38);
    note(s, `
なぜこの事業を始めるのか、です。左から右へ読んでください。
立ち作業、重い物の持ち上げ、中腰やくり返し動作、滑りやすい床。こうした職場の身体的な負担は、腰痛や転倒という形で従業員に影響します。企業にとっては、休業を伴う労働災害や「プレゼンティーイズム」――出勤しているのに体の不調で力を発揮しきれない状態――につながる可能性があります。
下の数字は厚生労働省が公表した2025年の全国・全業種の統計で、休業4日以上の労働災害のうち、転倒が37,195人、動作の反動・無理な動作が22,166人でした。課題が社会に存在する背景ではありますが、盛岡の企業で同じことが起きている証拠でも、WPCで減らせる証拠でもありません。
また2026年4月から、高年齢労働者の労災防止措置が事業者の努力義務になりました。ただしWPCを買うことが義務になったわけではありません。`);
  }

  // ---- 2つの柱と成果の3段階
  {
    const s = content(1, "WPCが目指すこと：2つの柱と、成果を確かめる3つの段階");
    const pillars = [
      [fa.FaPersonFalling, "柱1\n転倒・腰痛の予防", "体の動き（4項目）、過去4週間の腰痛、運動習慣を継続して把握する"],
      [md.MdTrendingUp, "柱2\n生産性の向上", "健康上の理由による仕事への影響（SPQ）や、健康理由の欠勤を把握する"],
    ];
    for (const [i, [ic, h, d]] of pillars.entries()) {
      const x = 0.6 + i * 3.2;
      card(s, x, 1.62, 3.0, 4.05, C.text2);
      await iconCircle(s, ic, x + 1.05, 1.82, 0.9, C.accent2);
      txt(s, h, { x: x + 0.15, y: 2.85, w: 2.7, h: 0.85, fontSize: 19, bold: true, color: C.background1, align: "center", valign: "middle" });
      txt(s, d, { x: x + 0.22, y: 3.75, w: 2.56, h: 1.8, fontSize: 16, color: C.background1 });
    }
    const steps = [
      ["第1段階", "安全に開催でき、同じ従業員が続けて参加する", "パイロットで確かめる"],
      ["第2段階", "運動の実施が増え、体の動きが変化する", "約3か月後の再評価で探索的に見る"],
      ["第3段階", "欠勤や事故などへの影響", "長期の検証課題。90日では主張しない"],
    ];
    steps.forEach(([h, d, w], i) => {
      const y = 1.62 + i * 1.38;
      const x = 7.2 + i * 0.35;
      card(s, x, y, 12.73 - x, 1.22);
      txt(s, h, { x: x + 0.2, y: y + 0.1, w: 1.4, h: 0.45, fontSize: 18, bold: true, color: C.accent2 });
      txt(s, d, { x: x + 0.2, y: y + 0.5, w: 12.4 - x, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
      txt(s, w, { x: x + 0.2, y: y + 0.86, w: 12.4 - x, h: 0.35, fontSize: 15, color: GRAY });
    });
    caution(s, "未実証", "年3〜4回の測定と運動支援で改善するかは確かめていません。「転倒を防ぐ」「医療費が下がる」「必ず改善する」とは約束しません", 5.85, 0.95, { fs: 16 });
    note(s, `
WPCが目指すことです。事業の目的は2本柱です。
柱1は転倒・腰痛の予防。体の動きを測る4項目、過去4週間の腰痛の有無、運動習慣を継続して把握します。
柱2は生産性の向上。健康上の理由で仕事にどのくらい影響が出ているかをSPQという質問で把握し、企業の勤怠記録が取れる場合は健康理由の欠勤も見ます。
大切なのは、成果を3つの段階で確かめることです。第1段階は、安全に開催でき、同じ従業員が続けて参加すること。これがパイロットで確かめる中心です。第2段階は、運動の実施が増え体の動きが変化すること。約3か月後の再評価で探索的に見ます。第3段階の欠勤や事故への影響は長期の検証課題で、90日の小さな実証では主張しません。
なお監査は、介入の量が小さいため、今のパイロットでは生産性は「記述的に見る」にとどめるべきと指摘しています。社外で「効果がある」とは言わないでください。`);
  }

  // ===== 第2章 =====
  section("第2章 どんなサービスか");
  {
    const s = content(2, "WPCを一言で説明すると");
    card(s, 0.6, 1.6, 12.13, 1.0, C.text2);
    txt(s, "企業を訪問し、従業員の体の動きを測り、一人ひとりに合った運動を支援し、職場には集計結果を報告するサービス", { x: 0.9, y: 1.6, w: 11.6, h: 1.0, fontSize: 21, bold: true, color: C.background1, valign: "middle" });
    const steps = [
      [md.MdDirectionsCar, "① 訪問する", "理学療法士が企業の職場へ出向く"],
      [fa.FaPersonWalking, "② 測る", "1人ずつ、安全を確認して体の動きを測定"],
      [md.MdSportsGymnastics, "③ 支援する", "その人に合った運動を1〜2種目"],
      [md.MdAssessment, "④ 報告する", "企業へは個人が分からない集計のみ"],
    ];
    for (const [i, [ic, h, d]] of steps.entries()) {
      const x = 0.6 + i * 3.1;
      card(s, x, 2.85, 2.75, 2.65);
      await iconCircle(s, ic, x + 0.9, 3.02, 0.95);
      txt(s, h, { x: x + 0.15, y: 4.05, w: 2.45, h: 0.45, fontSize: 21, bold: true, color: C.text2, align: "center" });
      txt(s, d, { x: x + 0.2, y: 4.52, w: 2.35, h: 0.9, align: "center", fontSize: 17 });
      if (i < 3) arrowR(s, x + 2.8, 4.0, 0.27, 0.4);
    }
    txt(s, "同じ従業員に年3〜4回くり返し、変化を追いかけます（回数は未確定）。料金を払うのは企業です", { x: 0.6, y: 5.65, w: 12.13, h: 0.55, fontSize: 18, valign: "middle" });
    glossary(s, "理学療法士（PT）＝体の動きの専門職（国家資格）。WPCでは診断・治療は行わない", 6.38);
    note(s, `
WPCを一言で言うと、「企業を訪問し、従業員の体の動きを測り、一人ひとりに合った運動を支援し、職場には集計結果を報告するサービス」です。
担当するのは理学療法士、PTです。PTは体の動きの専門職ですが、WPCでは病気の診断や治療は行いません。健康づくりのための測定と運動指導です。
①職場を訪問し、②1人ずつ安全を確認して測り、③その人に合った運動を1〜2種目指導し、④企業へは個人が特定できない集計だけを報告します。これを同じ従業員に年3〜4回くり返して変化を追うのが特徴です。年3回か4回かはまだ決まっていません。`);
  }

  // ---- 年間の流れ
  {
    const s = content(2, "年間サービスの流れ：同じ人を、同じ条件でくり返し測る");
    const st = [["契約", "本部と条件を決める"], ["事前準備", "参加枠・会場・同意"], ["測定", "1人ずつ安全に"], ["個別支援", "運動1〜2種目"], ["集計報告", "企業へは集計のみ"], ["継続支援", "職場体操・週1記録"], ["再評価", "同じ条件で測る"]];
    const w = 1.62, gap = 0.135;
    st.forEach(([h, d], i) => {
      const x = 0.6 + i * (w + gap);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.65, w, h: 0.72, fill: { color: i === 2 || i === 6 ? C.accent2 : C.text2 }, line: { type: "none" }, objectName: "flow " + h });
      txt(s, h, { x: x + (i === 0 ? 0.05 : 0.3), y: 1.65, w: w - (i === 0 ? 0.35 : 0.55), h: 0.72, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
      txt(s, d, { x, y: 2.45, w: w - 0.05, h: 0.62, fontSize: 15, align: "center", color: C.text1 });
    });
    // timeline
    txt(s, "年間スケジュールの案（12か月契約）", { x: 0.6, y: 3.3, w: 8, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    const X0 = 2.6, X1 = 12.5, mw = (X1 - X0) / 12;
    for (let m = 0; m <= 12; m++) {
      txt(s, m === 12 ? "12か月" : String(m), { x: X0 + m * mw - 0.35, y: 3.75, w: 0.7, h: 0.3, fontSize: 12, color: GRAY, align: "center" });
    }
    const rows = [["年4回", [0, 3, 6, 9]], ["年3回", [0, 4, 8]]];
    rows.forEach(([lab, ms], r) => {
      const y = 4.15 + r * 0.8;
      txt(s, lab, { x: 0.6, y, w: 1.8, h: 0.55, fontSize: 18, bold: true, color: C.text2, valign: "middle" });
      s.addShape(pres.shapes.RECTANGLE, { x: X0, y: y + 0.2, w: X1 - X0, h: 0.15, fill: { color: C.background2 }, line: { type: "none" }, objectName: "track" });
      ms.forEach((m, k) => {
        s.addShape(pres.shapes.OVAL, { x: X0 + m * mw - 0.27, y: y + 0.01, w: 0.54, h: 0.54, fill: { color: k === 0 ? C.text2 : C.accent2 }, line: { color: HEX.lt1, width: 1.5 }, objectName: "visit" });
        txt(s, k === 0 ? "初" : "再", { x: X0 + m * mw - 0.27, y: y + 0.01, w: 0.54, h: 0.54, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle" });
      });
    });
    txt(s, "訪問と訪問の間は、職場体操と週1回の記録で運動を続けてもらう", { x: X0, y: 5.75, w: X1 - X0, h: 0.4, fontSize: 15, color: GRAY });
    caution(s, "未確定", "年3回（第4版の標準）と年4回（財務モデルの前提）が並んでいます。パイロットは「初回＋約3か月後」の2回で行う案です", 6.2, 0.75, { fs: 16 });
    note(s, `
年間サービスの流れです。企業の本部と契約し、参加枠・会場・本人の同意を準備し、1人ずつ安全に測定して運動を1〜2種目指導します。企業には集計だけを報告し、訪問と訪問の間は職場体操と週1回の記録で運動を続けてもらいます。そして同じ条件で再評価します。
下の図は12か月契約のスケジュール案です。年4回なら初回・3か月後・6か月後・9か月後、年3回なら初回・4か月後・8か月後です。
ただし、第4版の正本は年3回を標準、財務モデルは年4回を前提にしていて、まだ一本化されていません。また、最初の有料パイロットは、初回と約3か月後の2回で行う案になっています。`);
  }

  // ---- 1回の測定日の流れ
  {
    const s = content(2, "1人あたりの流れ：初回は約35分を提案（案）");
    const phases = [
      ["受付・安静・質問票", 8, 6, C.accent3, C.text2],
      ["安全確認・血圧", 3, 3, C.accent4, C.background1],
      ["身体測定4項目", 14, 13, C.text2, C.background1],
      ["結果説明・運動", 5, 3, C.accent2, C.background1],
      ["記録・清拭", 2, 2, C.background2, C.text2],
      ["余白", 3, 3, C.background1, C.text2],
    ];
    const X0 = 2.55, X1 = 12.73, per = (X1 - X0) / 35;
    [["初回", 1], ["再評価", 2]].forEach(([lab, k], r) => {
      const y = 1.95 + r * 1.45;
      txt(s, lab, { x: 0.6, y, w: 1.8, h: 0.85, fontSize: 20, bold: true, color: C.text2, valign: "middle" });
      let x = X0;
      phases.forEach(([n, a, b, fill, fc]) => {
        const mins = k === 1 ? a : b;
        const w = mins * per;
        s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.85, fill: { color: fill }, line: { color: n === "余白" ? HEX.accent3 : HEX.lt1, width: 1, dashType: n === "余白" ? "dash" : "solid" }, objectName: "phase " + n });
        txt(s, `${mins}分`, { x, y, w, h: 0.85, fontSize: 16, bold: true, color: fc, align: "center", valign: "middle" });
        x += w;
      });
      txt(s, k === 1 ? "計35分枠" : "計30分枠", { x: x - 1.2, y: y + 0.88, w: 1.2, h: 0.35, fontSize: 14, bold: true, color: C.accent2, align: "right" });
    });
    // legend
    phases.slice(0, 5).forEach(([n, , , fill], i) => {
      const x = 0.6 + i * 2.45;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 4.9, w: 0.3, h: 0.3, fill: { color: fill }, line: { color: HEX.accent3, width: 0.75 }, objectName: "legend" });
      txt(s, n, { x: x + 0.4, y: 4.82, w: 2.0, h: 0.46, fontSize: 14, valign: "middle" });
    });
    frame(s, 0.6, 5.5, 12.13, 1.4);
    tag(s, "未確定", 0.8, 5.65, 1.2);
    txt(s, bullets([
      "第4版は「初回30分・再評価20分」。最新のプロトコル案（Ver.4.1）は机上計算で32分・27分かかるため「35分・30分」を提案",
      "どちらも実測前。模擬測定で90%以上が枠内に終わるかを確かめてから決める",
    ]), { x: 2.2, y: 5.55, w: 10.4, h: 1.3, fontSize: 16 });
    note(s, `
1人あたりの流れです。最新の測定プロトコル案Ver.4.1では、初回の中身を次のように見積もっています。受付と5分間の座位安静・質問票で8分、安全確認と血圧で3分、準備運動と身体測定4項目で14分、結果説明と運動指導で5分、記録と清拭で2分。合計32分に余白3分を加えて35分枠です。再評価は27分に余白を加えて30分枠です。
一方、事業計画書第4版では、初回30分・再評価20分としていました。最新案は、安全確認や休憩を削らずに測ると30分・20分には収まらない、という机上計算から35分・30分を提案しています。
どちらもまだ実測していません。模擬測定で、12人中11人以上が枠内に全工程を終えられるかを確かめてから決めます。時間を守るために安全確認や休憩を削ることはしません。
なお、片脚立ちが2回とも180秒近く続くと、この項目だけで約8分かかります。長い人がいる前提で、午前・午後に延長枠を用意する計画です。`);
  }

  // ---- 身体機能4項目
  {
    const s = content(2, "測定項目①　体の動きを見る4つの測定");
    const items = [
      ["twostep", "2ステップ", "大股で2歩進み、距離を身長で割る", "歩く力・脚の筋力やバランス"],
      ["seated", "座位ステッピング", "座ったまま20秒間、両足を床の線の内外へ動かす回数", "足を素早く動かす力"],
      ["standup", "40cm立ち上がり", "40cmの台から腕を組み、反動なしで立って3秒保つ", "脚の筋力（両脚で成功か）"],
      ["oneleg", "開眼片脚立位", "目を開け、手を腰に置き片脚で立つ（上限180秒）", "片脚で立つバランス"],
    ];
    for (const [i, [fig, h, d, w]] of items.entries()) {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.6, 2.88, 4.2);
      s.addShape(pres.shapes.OVAL, { x: x + 0.69, y: 1.75, w: 1.5, h: 1.5, fill: { color: C.background1 }, line: { color: C.accent3, width: 1.5 }, objectName: "illust" });
      s.addImage({ data: await svgPng(FIGS[fig]), x: x + 0.79, y: 1.85, w: 1.3, h: 1.3, altText: h + "の測定姿勢のイラスト" });
      txt(s, h, { x: x + 0.1, y: 3.35, w: 2.68, h: 0.45, fontSize: 19, bold: true, color: C.text2, align: "center" });
      txt(s, d, { x: x + 0.18, y: 3.85, w: 2.52, h: 1.0, fontSize: 16 });
      txt(s, [{ text: "わかること　", options: { bold: true, color: C.accent2 } }, { text: w }], { x: x + 0.18, y: 4.9, w: 2.52, h: 0.85, fontSize: 15 });
    }
    frame(s, 0.6, 5.95, 12.13, 0.95);
    tag(s, "承認前", 0.8, 6.245, 1.2);
    txt(s, "監査の指摘：40cm両脚は働く世代ではほぼ全員が成功して差が出にくい／片脚立位は180秒の上限に達する人が多い。片脚での立ち上がりや5回椅子立ち座りへの変更が提案されています", { x: 2.2, y: 5.98, w: 10.4, h: 0.9, fontSize: 15, valign: "middle" });
    note(s, `
ここから測定項目です。体の動きを見る測定は4つです。いずれも厚生労働省の職場向けセルフチェックや、日本整形外科学会の「ロコモ度テスト」の公式手順をもとにしています。
1つ目は2ステップ。できるだけ大股で2歩進み、その距離を身長で割ります。歩く力や脚の筋力・バランスの目安です。
2つ目は座位ステッピング。椅子に座ったまま、床に引いた30cm幅の2本の線の内と外へ、20秒間に両足を何回動かせるかを数えます。
3つ目は40cm立ち上がり。40cmの台から、腕を組んで反動を使わずに立ち上がり、3秒保てるかを見ます。
4つ目は開眼片脚立位。目を開けて、手を腰に置き、片脚で何秒立てるかを測ります。上限は180秒です。
いずれも診断ではなく、本人の運動の調整に使います。危ないと判断した人には無理に行いません。
ただし、監査は「40cm両脚はほぼ全員が成功して差が出ない」「片脚立位は上限に達する人が多い」と指摘し、変更を提案しています。正式な測定セットは模擬測定と責任者の承認を経て決めます。`);
  }

  // ---- 質問票
  {
    const s = content(2, "測定項目②　本人に答えてもらう質問");
    const qs = [
      ["SPQ（生産性の主要指標）", "病気やけががないときに発揮できる仕事の出来を100%として過去4週間の自身の仕事を評価してください。", "1〜100%で回答。東京大学が公開する日本語版（研究・商用とも無料と確認）"],
      ["腰痛（過去4週間）", "過去4週間に、腰の痛みがありましたか。", "あり／なし。WPC独自の質問で、痛みの強さや原因は分からない"],
      ["運動習慣", "1回30分以上の運動を、週2回以上、1年以上継続して行っていますか。", "はい／いいえ。1年以上が条件のため、3か月では変化しにくい"],
    ];
    const hs = [1.5, 1.1, 1.35], qh = [0.72, 0.36, 0.62];
    let yy = 1.6;
    qs.forEach(([h, q, d], i) => {
      const y = yy;
      card(s, 0.6, y, 8.2, hs[i]);
      txt(s, h, { x: 0.8, y: y + 0.08, w: 7.8, h: 0.38, fontSize: 17, bold: true, color: C.accent2 });
      txt(s, "「" + q + "」", { x: 0.8, y: y + 0.44, w: 7.85, h: qh[i], fontSize: 16, bold: true, color: C.text2 });
      txt(s, d, { x: 0.8, y: y + 0.48 + qh[i], w: 7.85, h: 0.32, fontSize: 13, color: GRAY });
      yy += hs[i] + 0.12;
    });
    card(s, 9.05, 1.6, 3.68, 4.19, C.background1);
    frame(s, 9.05, 1.6, 3.68, 4.19, C.accent3);
    txt(s, "条件が整えば追加", { x: 9.25, y: 1.72, w: 3.3, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    txt(s, [
      { text: "健康理由の欠勤", options: { bold: true, breakLine: true } },
      { text: "本人の同意と、企業の勤怠記録の定義がそろった場合のみ", options: { fontSize: 14, color: GRAY, breakLine: true } },
      { text: " ", options: { fontSize: 8, breakLine: true } },
      { text: "WAS（働く力の自己評価）", options: { bold: true, breakLine: true } },
      { text: "正式な日本語版と利用条件が未確認のため、現在は未導入", options: { fontSize: 14, color: GRAY } },
    ], { x: 9.25, y: 2.2, w: 3.3, h: 3.4, fontSize: 17 });
    caution(s, "注意", "回答は自己評価です。SPQの損失は実際の生産量・売上・利益の損失ではありません。腰痛の質問を当日の安全確認の代わりにはしません", 6.0, 0.85, { tw: 1.0, fs: 16 });
    note(s, `
質問票です。本人に答えてもらう質問は、標準で3つです。
1つ目はSPQ。生産性の主要な指標です。「病気やけががないときに発揮できる仕事の出来を100%として、過去4週間の自分の仕事を評価してください」と聞き、1〜100%で答えてもらいます。東京大学が公開している日本語版で、研究・商用とも無料で使えることを確認しています。
2つ目は腰痛。「過去4週間に、腰の痛みがありましたか」と、あり・なしで聞くWPC独自の質問です。痛みの強さや原因までは分かりません。
3つ目は運動習慣。「1回30分以上の運動を、週2回以上、1年以上継続していますか」。1年以上という条件があるので、3か月の取り組みでは変化しにくい指標です。監査は「直近4週の運動日数」への置き換えを提案しています。
右側は条件付きの項目です。健康理由の欠勤は、本人の同意と企業の勤怠記録の定義がそろった場合だけ使います。WASという働く力の自己評価は、正式な日本語版と利用条件が確認できていないため、今は導入しません。
回答はあくまで自己評価で、SPQの数字は売上や利益の損失ではない、という点に注意してください。`);
  }

  // ---- 測定項目の全体像
  {
    const s = content(2, "測定項目の全体像：標準・条件付き・任意・対象外");
    const cols = [
      ["標準（全員に予定）", C.text2, ["SPQ", "腰痛（過去4週間）", "運動習慣", "2ステップ", "座位ステッピング20秒", "40cm立ち上がり（両脚）", "開眼片脚立位180秒"]],
      ["条件付き", C.accent2, ["健康理由の欠勤（勤怠の同意・定義が必要）", "WAS（未導入）", "40cm片脚（左右）は適応がある人のみ"]],
      ["任意", C.accent4, ["InBody（体組成計）：機種未定・機器未保有。別予約の補助評価"]],
      ["当面は対象外", GRAY, ["握力・CS-30・5回椅子立ち座り（比較候補）", "閉眼片脚立位（安全上、承認された追加枠のみ）", "WFun などの追加質問票"]],
    ];
    cols.forEach(([h, col, items], i) => {
      const x = 0.6 + i * 3.08;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 2.88, h: 0.7, fill: { color: col }, line: { type: "none" }, rectRadius: 0.12, objectName: "head" });
      txt(s, h, { x: x + 0.1, y: 1.6, w: 2.68, h: 0.7, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
      card(s, x, 2.4, 2.88, 3.55);
      txt(s, bullets(items), { x: x + 0.15, y: 2.55, w: 2.63, h: 3.3, fontSize: i === 0 ? 16 : 15, paraSpaceAfter: 6 });
    });
    caution(s, "未確定", "InBodyは資料により「毎回」「任意」「パイロットから除外（監査）」と扱いが分かれています。実施しない項目にも、理由と状態を必ず記録します", 6.1, 0.85, { fs: 16 });
    note(s, `
測定項目の全体像を、4つに分けて整理しました。これは最新のプロトコル案Ver.4.1にもとづく整理で、まだ承認前です。
「標準」は全員に予定する項目で、質問3つと体の動き4つ、合わせて7項目です。
「条件付き」は、勤怠記録による健康理由の欠勤、WAS、そして40cmの片脚での立ち上がりです。片脚は、両脚で成功し痛みがなく、本人が同意した人だけに行います。
「任意」はInBodyという体組成計です。機種が決まっておらず、機器も持っていません。
「当面は対象外」は、握力や5回椅子立ち座りなどの比較候補、安全上の理由で追加枠に限る閉眼片脚立位などです。
InBodyは、資料によって「毎回測る」「任意」「パイロットからは除外すべき」と扱いが分かれていて、まだ決まっていません。
また、実施しなかった項目も、拒否・安全上の見送り・未導入などの理由を必ず記録します。空欄を0として扱わないためです。`);
  }

  // ---- 安全の仕組み
  {
    const s = content(2, "安全に測るための仕組み");
    const flow = [["事前確認", "症状・痛み・運動制限・本人の意思"], ["5分安静＋血圧", "座って5分以上休んでから測る"], ["判断", "測る／一部見送り／延期"], ["測定", "補助者が支えられる位置に立つ"], ["中止基準", "痛み・胸の症状・ふらつき・本人の希望ですぐ中止"]];
    flow.forEach(([h, d], i) => {
      const x = 0.6 + i * 2.44;
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.62, w: 2.36, h: 0.7, fill: { color: i === 4 ? C.accent6 : C.text2 }, line: { type: "none" }, objectName: "safety flow" });
      txt(s, h, { x: x + (i ? 0.35 : 0.1), y: 1.62, w: 1.75, h: 0.7, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
      txt(s, d, { x: x + 0.1, y: 2.4, w: 2.25, h: 0.8, fontSize: 14, align: "center" });
    });
    card(s, 0.6, 3.35, 6.0, 2.6);
    txt(s, "血圧による判断（案）", { x: 0.8, y: 3.45, w: 5.6, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    txt(s, [
      { text: "160/100以上", options: { bold: true, color: C.accent4 } },
      { text: "　追加で5分休み再確認。続くなら当日の身体測定は見合わせ、医療相談へ", options: { breakLine: true } },
      { text: "180/110以上", options: { bold: true, color: C.accent6 } },
      { text: "　身体測定は行わず、医療相談を優先", options: { breakLine: true } },
      { text: "症状があれば", options: { bold: true, color: C.accent6 } },
      { text: "　数値に関係なく救急の判断" },
    ], { x: 0.8, y: 3.95, w: 5.65, h: 1.95, fontSize: 15, paraSpaceAfter: 8 });
    card(s, 6.83, 3.35, 5.9, 2.6);
    txt(s, "緊急時の役割（1つの測定列）", { x: 7.03, y: 3.45, w: 5.5, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    txt(s, [
      { text: "A 測定担当", options: { bold: true } }, { text: "　測定を止め、安全を確保し反応と呼吸を確認", options: { breakLine: true } },
      { text: "B 補助担当", options: { bold: true } }, { text: "　応援を呼び、AEDを手配", options: { breakLine: true } },
      { text: "C 受付", options: { bold: true } }, { text: "　119番通報と入口誘導。他の参加者を安全な場所へ" },
    ], { x: 7.03, y: 3.95, w: 5.55, h: 1.95, fontSize: 15, paraSpaceAfter: 8 });
    caution(s, "未完了", "数値基準は医療安全責任者の承認前の案です。救急連絡先・医療相談先・AEDの位置などは拠点ごとに未記入で、そろうまで測定は始めません", 6.1, 0.85, { kind: "accent6", fs: 15 });
    note(s, `
安全の仕組みです。測定前に、症状、痛み、医師からの運動制限、本人の意思を確認します。最新の案では、全員に座って5分以上休んでもらってから血圧を測り、測るか、一部を見送るか、延期するかを判断します。測定中は補助者が支えられる位置に立ち、痛み、胸の症状、ふらつきがあったり、本人が希望したりしたら、すぐに中止します。
血圧の判断は案ですが、160/100以上なら追加で休んで再確認し、続く場合は当日の身体測定を見合わせて医療相談へ。180/110以上なら身体測定は行わず医療相談を優先。症状がある場合は数値に関係なく救急の判断をします。
緊急時は、1つの測定列のAが測定を止めて安全を確保し、Bが応援とAEDを手配し、受付のCが119番通報と入口誘導をします。上司の許可を待って通報を遅らせることはしません。
これらの数値基準は、医師などの安全責任者がまだ承認していない案です。救急連絡先やAEDの位置などは拠点ごとにまだ未記入で、これがそろうまで従業員の測定は始めません。`);
  }

  // ---- 運動支援
  {
    const s = content(2, "測定後の運動支援：3つの層で続けてもらう");
    const blocks = [
      [md.MdSportsGymnastics, "個別運動指導", ["測定当日にPTが指導", "原則1〜2種目", "本人ができるまで確認", "痛む動作は続けない"]],
      [md.MdGroups, "職場での体操", ["1〜3分の短い体操", "勤務内の取りやすい時間", "荷物を持ったまま行わない", "参加しなくても不利益なし"]],
      [md.MdEventNote, "継続支援", ["週1回を目安に実施を記録", "次回訪問で運動を見直す", "症状がある人は受診を案内", "医療相談・治療は行わない"]],
    ];
    for (const [i, [ic, h, items]] of blocks.entries()) {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.62, 3.88, 3.55);
      await iconCircle(s, ic, x + 0.25, 1.8, 0.75);
      txt(s, h, { x: x + 1.15, y: 1.8, w: 2.6, h: 0.75, fontSize: 21, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(items), { x: x + 0.3, y: 2.75, w: 3.45, h: 2.3, paraSpaceAfter: 6 });
    }
    frame(s, 0.6, 5.35, 12.13, 1.5, GRAY, "dash");
    tag(s, "未確定", 0.85, 5.92, 1.2);
    txt(s, bullets([
      "計画書には「開催の間のWeb支援（メニュー・記録・リマインド）」がありますが、当面は専用システムを導入しない方針。紙・メール・既存ツールで行う案",
      "職場での継続支援を Office Training（当社の法人向け訪問サービス）とどう分けるかも未確定",
    ]), { x: 2.25, y: 5.42, w: 10.35, h: 1.38, fontSize: 15 });
    note(s, `
測定後の運動支援は3つの層で考えています。
1つ目は個別運動指導。測定当日にPTが原則1〜2種目の運動を、本人が自分でできるようになるまで確認しながら指導します。痛みが出る動作は続けさせません。
2つ目は職場での体操。1〜3分程度の短い体操を、勤務時間内の取りやすいタイミングに組み込みます。荷物を持ったままでは行わず、参加しなくても不利益がないようにします。
3つ目は継続支援。週1回を目安に実施状況を記録してもらい、次の訪問で運動を見直します。症状がある方には受診を案内し、医療相談や治療は行いません。
注意点として、計画書にある「開催の間のWeb支援」は、追補で専用システムを当面導入しない方針になり、方法が決まっていません。また、職場での継続支援を当社のOffice Trainingとどう分けるかも未確定です。社外ではWeb支援を約束しないでください。`);
  }

  // ===== 第3章 =====
  section("第3章 何を測り、どう報告するか");
  {
    const s = content(3, "KPIは3つの層で見る");
    const layers = [
      ["事業のKPI", "売れるか・採算が合うか", "面談数・見積数・有料発注数・限界利益率・更新率", C.accent4],
      ["運営のKPI（パイロットの主評価）", "安全に・時間内に・続けて実施できるか", "予約の充足・再測定率・時間内完了率・事故0件・誤共有0件", C.accent2],
      ["健康のKPI（K01〜K14）", "参加者の体と仕事にどんな変化があるか", "SPQ・腰痛・体の動き4項目・運動習慣など。探索的に記述", C.text2],
    ];
    layers.forEach(([h, q, ex, col], i) => {
      const y = 1.62 + i * 1.5;
      const inset = (2 - i) * 0.0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6 + inset, y, w: 4.1, h: 1.3, fill: { color: col }, line: { type: "none" }, rectRadius: 0.12, objectName: "layer" });
      txt(s, h, { x: 0.8, y, w: 3.75, h: 1.3, fontSize: 19, bold: true, color: C.background1, valign: "middle" });
      card(s, 4.85, y, 7.88, 1.3);
      txt(s, [{ text: q, options: { bold: true, color: C.text2, breakLine: true, fontSize: 18 } }, { text: ex, options: { fontSize: 15 } }], { x: 5.05, y: y + 0.1, w: 7.5, h: 1.1, valign: "middle", paraSpaceAfter: 4 });
    });
    caution(s, "大事な順番", "パイロットで最初に確かめるのは「運営のKPI」。健康のKPIの変化は、効果の証明ではなく記述として扱います", 6.0, 0.7, { tw: 1.5, fs: 15 });
    txt(s, "KPI＝事業やサービスが順調かを確かめるための指標", { x: 0.6, y: 6.74, w: 12.13, h: 0.28, fontSize: 13, color: GRAY });
    note(s, `
ここからKPIの話です。KPIとは、事業やサービスが順調かを確かめるための指標のことです。WPCのKPIは3つの層で考えるとわかりやすくなります。
1つ目は事業のKPI。売れるか、採算が合うかを見るもので、面談数、見積数、有料発注数、限界利益率、更新率などです。
2つ目は運営のKPI。安全に、時間内に、続けて実施できるかを見るもので、予約の充足、再測定率、時間内に終わった割合、事故や情報の誤共有が0件か、などです。これがパイロットで最初に確かめる「主評価」です。
3つ目は健康のKPIで、K01からK14まで番号がついています。SPQ、腰痛、体の動き4項目、運動習慣などで、参加者の変化を見ます。
大事なのは順番です。最初のパイロットは、比べる対照グループのない小さな前後比較なので、健康のKPIが良くなっても「効果があった」とは言えません。記述として扱います。`);
  }

  // ---- KPI一覧（健康）
  {
    const s = content(3, "健康のKPI一覧：2つの柱に対応させる");
    const col = (x, w, head, colr, items) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w, h: 0.62, fill: { color: colr }, line: { type: "none" }, rectRadius: 0.12, objectName: "kpi head" });
      txt(s, head, { x: x + 0.15, y: 1.6, w: w - 0.3, h: 0.62, fontSize: 18, bold: true, color: C.background1, valign: "middle" });
      card(s, x, 2.3, w, 3.75);
      items.forEach(([k, n, st], i) => {
        const y = 2.42 + i * (3.55 / Math.max(items.length, 5));
        txt(s, k, { x: x + 0.12, y, w: 0.65, h: 0.42, fontSize: 14, bold: true, color: C.accent2, valign: "middle" });
        txt(s, n, { x: x + 0.75, y, w: w - 1.6, h: 0.42, fontSize: 14, valign: "middle" });
        txt(s, st, { x: x + w - 0.88, y, w: 0.8, h: 0.42, fontSize: 12, color: st === "標準" ? C.accent5 : C.accent4, bold: true, valign: "middle", align: "right" });
      });
    };
    col(0.6, 4.75, "柱1　転倒・腰痛の予防", C.text2, [
      ["K04", "過去4週間の腰痛有症率", "標準"], ["K05", "40cm両脚立ち上がり成功率", "標準"], ["K06", "2ステップ値", "標準"],
      ["K07", "座位ステッピング20秒", "標準"], ["K08", "開眼片脚立位（180秒上限）", "標準"], ["K13", "運動習慣の保有率", "標準"], ["K14", "転倒・腰痛関連の労災", "長期"],
    ]);
    col(5.5, 3.6, "柱2　生産性の向上", C.accent2, [
      ["K01", "SPQ推計損失率", "標準"], ["K02", "WAS", "未導入"], ["K03", "健康理由欠勤率", "条件付き"], ["K12", "経済的な参考試算", "標準外"],
    ]);
    col(9.25, 3.48, "運営・補助", C.accent4, [
      ["K10", "実施しやすさ・安全", "主評価"], ["K09", "InBody", "任意"], ["K11", "WFun", "標準外"],
    ]);
    caution(s, "承認前", "KPI定義書 Ver.4.0案（承認前）より。K01 SPQが生産性の主要指標。健康のKPIは「改善の証明」ではなく、変化の記述に使います", 6.2, 0.75, { fs: 15 });
    note(s, `
健康のKPIを、事業の2つの柱に対応させて並べました。KPI定義書Ver.4.0案からの整理で、まだ承認前です。
左の柱1、転倒・腰痛の予防には、過去4週間の腰痛有症率、体の動き4項目、運動習慣、そして長期指標として転倒・腰痛に関連する労災があります。
中央の柱2、生産性の向上には、生産性の主要指標であるK01のSPQ、未導入のWAS、条件付きの健康理由欠勤、そして標準外の経済的な参考試算があります。
右は運営と補助です。K10の実行可能性・安全・負担がパイロットの主評価で、InBodyは任意、WFunは標準外です。
緑の「標準」以外は、まだ使える条件がそろっていない項目です。たとえば労災は、40人規模で3か月見ても件数がほとんど出ないため、長期の参考指標と位置づけています。`);
  }

  // ---- 数字の読み方
  {
    const s = content(3, "数字の読み方：3つの注意点");
    const ex = [
      ["1", "「%」の差は「ポイント」で表す", "SPQ回答 80%→85% なら推計損失は 20%→15%。差は「−5ポイント」で「25%改善」ではない", "例は資料に載っている架空の受入例"],
      ["2", "上限がある測定は平均だけで見ない", "片脚立位は180秒で打ち切るため、上限に届いた人の割合と中央値を中心に報告する", "180秒＝その人の限界ではない"],
      ["3", "変化＝効果ではない", "比べる対照グループがない前後比較では、季節・慣れ・偶然の影響を区別できない", "0件／40人でも事故率の上限は約7.5%"],
    ];
    ex.forEach(([n, h, d, f], i) => {
      const y = 1.6 + i * 1.55;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.2, w: 0.85, h: 0.85, fill: { color: C.text2 }, line: { type: "none" }, objectName: "num" });
      txt(s, n, { x: 0.6, y: y + 0.2, w: 0.85, h: 0.85, fontSize: 26, bold: true, color: C.background1, align: "center", valign: "middle" });
      card(s, 1.65, y, 11.08, 1.38);
      txt(s, h, { x: 1.85, y: y + 0.08, w: 10.7, h: 0.45, fontSize: 19, bold: true, color: C.text2 });
      txt(s, d, { x: 1.85, y: y + 0.52, w: 10.7, h: 0.5, fontSize: 16 });
      txt(s, f, { x: 1.85, y: y + 0.98, w: 10.7, h: 0.35, fontSize: 13, color: GRAY });
    });
    glossary(s, "ポイント（pp）＝割合どうしの差。20%と15%の差は5ポイント", 6.38);
    note(s, `
数字の読み方について、3つの注意点です。社内で結果を話すときや、企業に説明するときにも大事になります。
1つ目。割合の差は「ポイント」で表します。SPQの回答が80%から85%になると、推計の損失は20%から15%になります。この差は「5ポイント減った」であり、「25%改善した」と言ってはいけません。この例はKPI定義書にある架空の確認用の例です。
2つ目。上限がある測定は、平均だけで見ないことです。片脚立位は180秒で打ち切るので、180秒に届いた人の割合と中央値を中心に報告します。180秒はその人の限界ではありません。
3つ目。変化イコール効果ではありません。比べる対照グループがない前後比較では、季節や慣れ、偶然の影響と区別できません。また事故が40人中0件だったとしても、統計的には事故率の上限が約7.5%ありうる、という意味でしかありません。`);
  }

  // ---- パイロットの判定基準
  {
    const s = content(3, "パイロットで確かめる運営のKPI（社内の暫定基準）");
    const rows = [
      ["指標", "目標案", "何を見るか"],
      ["予約枠の充足率", "80%以上", "用意した枠が埋まるか"],
      ["再測定率（追跡参加率）", "80%以上", "初回の人が再評価にも来るか。60%未満は運用を再設計"],
      ["運動の記録率", "60%以上", "8週時点で直近4週のうち3週以上記録した人"],
      ["時間内の全工程完了率", "80〜90%以上", "安全確認・説明を削らず枠内で終わるか（資料で値が異なる）"],
      ["項目の有効取得率", "90%以上", "予定した測定が有効に取れたか"],
      ["重大事故・データ誤共有", "0件", "1件でも出たら一時停止して原因を評価"],
    ];
    const tbl = rows.map((r, i) => r.map((c, j) => ({ text: c, options: { bold: i === 0 || j < 2, fontSize: i === 0 ? 17 : 16, color: i === 0 ? C.background1 : j === 1 ? C.accent2 : C.text1, fill: { color: i === 0 ? C.text2 : i % 2 ? C.background2 : C.background1 }, valign: "middle", margin: [3, 10, 3, 10] } })));
    s.addTable(tbl, { x: 0.6, y: 1.6, w: 12.13, colW: [3.4, 2.3, 6.43], rowH: 0.58, border: { type: "solid", pt: 1, color: HEX.accent3 } });
    caution(s, "注意", "経営・運営上の暫定基準で、科学的な有効性の基準ではありません。結果を見た後で基準や分母を都合よく変えません", 5.85, 0.75, { tw: 1.0, fs: 16 });
    txt(s, "分母の例：再評価に来なかった人・安全上見送った人も分母に残す（来た人だけで率を計算しない）", { x: 0.6, y: 6.68, w: 12.13, h: 0.35, fontSize: 14, color: GRAY });
    note(s, `
パイロットで最初に確かめる運営のKPIです。事業計画書と品質管理の案から、社内の暫定基準をまとめました。
予約枠の充足率80%以上。再測定率、つまり初回に来た人が再評価にも来る割合が80%以上。60%未満なら運用を作り直します。運動の記録率は、8週時点で直近4週のうち3週以上記録した人が60%以上。時間内に全工程を終えた割合は、事業計画書では80%、最新の品質管理案では90%と、資料で値が違います。予定した測定が有効に取れた割合は90%以上。そして重大事故とデータの誤共有は0件で、1件でも起きたら一時停止して原因を評価します。
これらは経営・運営上の暫定基準で、科学的な有効性の基準ではありません。また、結果を見てから基準や分母を都合よく変えないことを決めています。再評価に来なかった人や安全上見送った人も分母に残し、来た人だけで率を計算しない、というのがルールです。`);
  }

  // ---- 企業レポート6ページ
  {
    const s = content(3, "企業向けレポート：6ページ構成（β1.0の案）");
    const pages = [
      ["1", "経営者向けサマリー", "主要KPI・参加の流れ・安全の要約", "bars"],
      ["2", "健康関連の生産性", "SPQ・WAS（条件付き）・健康理由欠勤率", "bars"],
      ["3", "身体機能の測定結果", "2ステップ・片脚立位・40cm・座位ステッピング", "dots"],
      ["4", "腰痛・運動習慣", "有症率・保有率と同じ人の変化", "bars"],
      ["5", "健康状態と生産性の関連", "探索的な分析（監査は実施しないよう提案）", "scatter"],
      ["6", "推奨施策と次回評価", "課題・施策・担当・時期・再評価KPI", "list"],
    ];
    pages.forEach(([n, h, d, kind], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * 4.12, y = 1.6 + row * 2.3;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.88, h: 2.12, fill: { color: C.background1 }, line: { color: HEX.accent3, width: 1.25 }, shadow: { type: "outer", color: "9FB6CF", opacity: 0.35, blur: 4, offset: 2, angle: 45 }, objectName: "page" });
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.88, h: 0.5, fill: { color: i === 4 ? C.accent4 : C.text2 }, line: { type: "none" }, objectName: "page head" });
      txt(s, `${n}  ${h}`, { x: x + 0.15, y, w: 3.6, h: 0.5, fontSize: 16, bold: true, color: C.background1, valign: "middle" });
      txt(s, d, { x: x + 0.15, y: y + 0.6, w: 2.25, h: 1.4, fontSize: 14 });
      // mini illustration (no numbers)
      const ix = x + 2.55, iy = y + 0.7;
      if (kind === "bars") [0.5, 0.8, 0.65].forEach((hh, k) => s.addShape(pres.shapes.RECTANGLE, { x: ix + k * 0.38, y: iy + 1.1 - hh, w: 0.26, h: hh, fill: { color: k === 1 ? C.accent2 : C.accent3 }, line: { type: "none" }, objectName: "deco" }));
      if (kind === "dots") [0.3, 0.55, 0.8, 1.0].forEach((v, k) => s.addShape(pres.shapes.OVAL, { x: ix + v * 0.9, y: iy + k * 0.28, w: 0.16, h: 0.16, fill: { color: C.accent2 }, line: { type: "none" }, objectName: "deco" }));
      if (kind === "scatter") [[0.1, 0.8], [0.35, 0.6], [0.5, 0.7], [0.7, 0.35], [0.9, 0.3]].forEach(([a, b]) => s.addShape(pres.shapes.OVAL, { x: ix + a, y: iy + b, w: 0.13, h: 0.13, fill: { color: C.accent4 }, line: { type: "none" }, objectName: "deco" }));
      if (kind === "list") [0, 1, 2].forEach((k) => s.addShape(pres.shapes.RECTANGLE, { x: ix, y: iy + 0.15 + k * 0.32, w: 1.05, h: 0.13, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "deco" }));
    });
    card(s, 0.6, 6.25, 12.13, 0.72, C.background2);
    txt(s, [{ text: "全ページ共通の注記　", options: { bold: true, color: C.accent2 } }, { text: "「観察された測定値の変化であり、介入の因果効果、個人の有意改善、転倒災害の減少、売上・利益の増加を証明するものではありません」" }], { x: 0.8, y: 6.25, w: 11.8, h: 0.72, fontSize: 14, valign: "middle" });
    note(s, `
企業向けレポートの構成です。標準測定マニュアルとKPI定義書で、6ページの「β1.0」という案ができています。図はページのイメージで、数字は入れていません。
1ページ目は経営者向けのサマリーで、主要なKPI、参加の流れ、安全の要約。2ページ目は生産性で、SPQ、条件がそろえばWAS、健康理由の欠勤率。3ページ目は身体機能の4項目。4ページ目は腰痛と運動習慣。5ページ目は健康状態と生産性の関連を見る探索的な分析。6ページ目は推奨する施策と次回の評価です。
全ページに「観察された変化であり、効果や売上・利益の増加を証明するものではない」という注記を入れます。
監査からは2つ指摘がありました。3ページ目の名称「転倒予防関連評価」は予防効果を示唆するので「バランス・移動機能の測定結果」に改めること。5ページ目の関連分析は、約30組のデータで多くの比較をすると偶然の相関が出るので、パイロットでは行わないこと。いずれもまだ反映前です。`);
  }

  // ---- 本人と企業：データの流れ
  {
    const s = content(3, "本人と企業に渡るもの、渡らないもの");
    card(s, 4.92, 1.75, 3.5, 2.45, C.text2);
    await iconCircle(s, md.MdLock, 6.22, 1.9, 0.9, C.accent2);
    txt(s, "測定データ\nWPCが管理", { x: 4.92, y: 2.9, w: 3.5, h: 0.85, fontSize: 19, bold: true, color: C.background1, align: "center" });
    txt(s, "氏名の対応表は別に保管", { x: 4.92, y: 3.72, w: 3.5, h: 0.4, fontSize: 13, color: C.accent3, align: "center" });
    card(s, 0.6, 1.6, 3.75, 3.2);
    await iconCircle(s, md.MdPerson, 0.82, 1.78, 0.7);
    txt(s, "本人へ：結果票", { x: 1.65, y: 1.78, w: 2.6, h: 0.7, fontSize: 19, bold: true, color: C.text2, valign: "middle" });
    txt(s, bullets(["今回と前回の値", "比べられる条件か", "続けやすい運動と中止の目安", "本人確認のうえ本人だけに"]), { x: 0.82, y: 2.6, w: 3.4, h: 2.1, fontSize: 16 });
    card(s, 8.98, 1.6, 3.75, 3.2);
    await iconCircle(s, md.MdBusiness, 9.2, 1.78, 0.7);
    txt(s, "企業へ：集計のみ", { x: 10.03, y: 1.78, w: 2.6, h: 0.7, fontSize: 19, bold: true, color: C.text2, valign: "middle" });
    txt(s, bullets(["参加人数・継続状況", "集団の平均や割合", "10人未満は原則非表示", "差し引きで分かる場合も伏せる"]), { x: 9.2, y: 2.6, w: 3.4, h: 2.1, fontSize: 16 });
    s.addShape(pres.shapes.LEFT_ARROW, { x: 4.42, y: 2.7, w: 0.45, h: 0.5, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "arrow" });
    arrowR(s, 8.47, 2.7, 0.45, 0.5);
    card(s, 0.6, 5.0, 6.0, 1.9, C.background1);
    frame(s, 0.6, 5.0, 6.0, 1.9, C.accent6);
    txt(s, [{ text: "企業に渡さないもの", options: { bold: true, color: C.accent6, breakLine: true, fontSize: 18 } }, { text: "個人の測定値・健康の回答・本人の結果票の一覧・参加しなかった理由・自由記述・元のExcel", options: { fontSize: 16 } }], { x: 0.85, y: 5.08, w: 5.6, h: 1.75 });
    card(s, 6.83, 5.0, 5.9, 1.9);
    txt(s, [{ text: "企業と取り決めること", options: { bold: true, color: C.text2, breakLine: true, fontSize: 18 } }, { text: "参加は任意。参加しないことや結果を人事評価に使わない。料金を払っても個人の値は見られない", options: { fontSize: 16 } }], { x: 7.05, y: 5.08, w: 5.5, h: 1.75 });
    note(s, `
本人と企業に、何が渡り、何が渡らないかです。
測定データはWPCが管理し、氏名との対応表は別に保管します。本人には、今回と前回の値、比べられる条件か、続けやすい運動と中止の目安を載せた結果票を、本人確認のうえ本人だけに渡します。
企業には集計だけを渡します。参加人数や継続状況、集団の平均や割合です。10人未満の小さな集団は原則として表示しません。さらに、全体からある店舗の数字を引き算すると別の店舗の個人が分かってしまう、といった場合も伏せます。
企業に渡さないのは、個人の測定値、健康の回答、本人の結果票の一覧、参加しなかった理由、自由記述、元のExcelです。
企業とは、参加は任意であること、参加しないことや結果を人事評価に使わないこと、料金を払っても個人の値は見られないことを取り決めます。
なお、WPCが本人から直接情報を預かるのか、企業の委託を受けるのかという法的な構造は未確定で、監査は「WPCが独立して取得し、企業へは集計のみ」に固定するよう求めています。`);
  }

  // ---- データ管理と品質
  {
    const s = content(3, "記録から報告まで：データの品質を守る手順");
    const steps = ["原票（紙）", "入力", "二者照合", "解析データ確定", "集計", "開示審査", "企業報告"];
    const w = 1.62, gap = 0.135;
    steps.forEach((h, i) => {
      const x = 0.6 + i * (w + gap);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.65, w, h: 0.75, fill: { color: i === 5 ? C.accent4 : C.text2 }, line: { type: "none" }, objectName: "data flow" });
      txt(s, h, { x: x + (i === 0 ? 0.05 : 0.3), y: 1.65, w: w - (i === 0 ? 0.35 : 0.55), h: 0.75, fontSize: 15, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    const rules = [
      ["空欄を0にしない", "拒否・安全上の見送り・未導入などは「状態コード」で区別して記録"],
      ["全試行を残す", "良い値だけでなく、無効や中止になった試行も原票に残す"],
      ["訂正は履歴付き", "訂正前の値・理由・担当・日時を残し、元の値を消さない"],
      ["2人で確認", "初回の各拠点10人は全原票を二重照合。以降もIDと値を照合"],
    ];
    rules.forEach(([h, d], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 2.65 + row * 1.35;
      card(s, x, y, 5.96, 1.2);
      txt(s, h, { x: x + 0.2, y: y + 0.08, w: 5.6, h: 0.42, fontSize: 18, bold: true, color: C.text2 });
      txt(s, d, { x: x + 0.2, y: y + 0.52, w: 5.6, h: 0.62, fontSize: 15 });
    });
    caution(s, "未完了", "集計用Excel（β1.0）は100行までしか集計できず、パイロットの160訪問に足りないなど18件の不具合が未修正。修正と試験が終わるまで実測の報告に使いません", 5.5, 1.0, { kind: "accent6", fs: 15 });
    txt(s, "現場の記録票はF01〜F08（登録・同意／安全・血圧／質問票／試行別原票／勤怠・InBody／時間・安全事象／本人結果・企業審査／訂正）の8種類を案として作成済み", { x: 0.6, y: 6.58, w: 12.13, h: 0.42, fontSize: 13, color: GRAY });
    note(s, `
記録から報告までの流れと、データの品質を守るルールです。
紙の原票に記録し、入力し、2人で照合し、解析用のデータを確定させ、集計し、個人が特定されないかの開示審査を経て、企業に報告します。
ルールは4つです。1つ目、空欄を0にしない。拒否、安全上の見送り、未導入などは「状態コード」で区別します。2つ目、良い値だけでなく無効や中止の試行もすべて残す。3つ目、訂正は履歴付きで、元の値を消さない。4つ目、2人で確認する。最初の各拠点10人は全原票を二重照合します。
大きな課題が集計用のExcelです。β1.0は100行までしか集計できず、80人×2回の160訪問に足りないことをはじめ、18件の不具合が見つかっていて、まだ修正されていません。修正と試験が終わるまで、実測データの報告には使いません。
現場の記録票は、登録・同意から訂正票まで8種類の案ができています。`);
  }
};
