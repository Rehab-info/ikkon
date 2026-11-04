// 第4章〜付録
const md = require("react-icons/md");
const fa = require("react-icons/fa6");
const L = require("./lib.js");
const { pres, C, HEX, GRAY, GRID, section, tag, content, card, frame, txt, iconCircle, bullets, note, glossary, caution, arrowR, chartBase } = L;

module.exports = async function () {
  // ===== 第4章 =====
  section("第4章 誰に売るのか");
  {
    const s = content(4, "対象となる業種と、提案の切り口");
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
    hdr.forEach((h, j) => {
      s.addShape(pres.shapes.RECTANGLE, { x: xs[j], y: y0, w: ws[j], h: 0.55, fill: { color: C.text2 }, line: { color: HEX.lt1, width: 1 }, objectName: "th" });
      txt(s, h, { x: xs[j] + 0.12, y: y0, w: ws[j] - 0.2, h: 0.55, bold: true, color: C.background1, valign: "middle" });
    });
    for (const [i, r] of rows.entries()) {
      const y = y0 + 0.55 + i * rh;
      for (let j = 0; j < 4; j++) s.addShape(pres.shapes.RECTANGLE, { x: xs[j], y, w: ws[j], h: rh, fill: { color: i % 2 ? C.background1 : C.background2 }, line: { color: HEX.accent3, width: 1 }, objectName: "td" });
      await iconCircle(s, r[0], xs[0] + 0.12, y + 0.12, 0.56);
      txt(s, r[1], { x: xs[0] + 0.8, y, w: 2.15, h: rh, bold: true, color: C.text2, valign: "middle" });
      tag(s, r[2], xs[1] + 0.1, y + 0.22, 0.75, r[2] === "A" ? "accent2" : GRAY);
      txt(s, r[3], { x: xs[2] + 0.12, y, w: ws[2] - 0.22, h: rh, valign: "middle", fontSize: 17 });
      txt(s, r[4], { x: xs[3] + 0.12, y, w: ws[3] - 0.22, h: rh, valign: "middle", fontSize: 17 });
    }
    txt(s, "優先度B：ホームセンター・介護福祉・清掃・外食　／　C：運送・建設設備", { x: 0.6, y: 6.18, w: 12.13, h: 0.35, fontSize: 15, color: GRAY });
    txt(s, "負担は仕事の内容から考えた仮説で、各社で問題が起きていると確認したものではありません。原価・手順は小売モデルのままで、業種ごとの再見積が必要です", { x: 0.6, y: 6.5, w: 12.13, h: 0.5, fontSize: 14, color: C.accent4 });
    note(s, `
ここから第4章、誰に売るのかです。2026年11月4日の改訂で、WPCは小売中心から「業種横断」の方針に変わりました。
優先度Aは、食品製造、物流倉庫、ホテル宿泊、製造業です。食品製造では立ち作業やくり返し動作、物流では荷物の持ち上げや低温環境、ホテルでは客室清掃の中腰や厨房の立ち作業などが考えられます。スーパーやドラッグストアなどの小売は、従来の候補として別枠で並行して当たります。
優先度Bはホームセンター、介護福祉、清掃、外食、Cは運送、建設設備です。
ここに書いた負担は、仕事の内容から考えた仮説で、候補企業で実際に問題が起きていると確認したものではありません。また監査は、業種を広げた一方で原価や手順は小売モデルのままであること、業種ごとに衛生区域・交替勤務・会場の条件が大きく違うことを指摘し、最初は1業種・1法人に絞るよう提案しています。`);
  }

  {
    const s = content(4, "競合と代替手段：無料の公的支援も比較相手");
    const groups = [
      ["無料の公的支援（地域）", C.accent4, ["岩手産業保健総合支援センター：PT等の無料職場訪問（測定・運動指導・環境助言）", "盛岡市：職場への無料の健康づくり出前講座", "岩手県よぼういがく協会：健康講座・保健師の定期訪問"]],
      ["全国の事業者（公開価格・税込）", C.accent2, ["NCS：10名・2時間55,000円〜（会場・交通費別）", "コナミスポーツ：4時間・最大100名385,000円", "バックテック：法人向け継続健康支援（公式ページに価格の記載なし）"]],
      ["社内でできること", GRAY, ["社内体操・既存の産業保健活動・動画配信", "現状維持（追加費用なし）"]],
    ];
    groups.forEach(([h, col, items], i) => {
      const y = 1.6 + [0, 1.55, 3.1][i];
      const hh = i === 2 ? 0.85 : 1.45;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 2.3, h: hh, fill: { color: col }, line: { type: "none" }, rectRadius: 0.12, objectName: "group" });
      txt(s, h, { x: 0.7, y, w: 2.1, h: hh, fontSize: 16, bold: true, color: C.background1, valign: "middle" });
      card(s, 3.0, y, 5.0, hh);
      txt(s, bullets(items), { x: 3.15, y: y + 0.08, w: 4.75, h: hh - 0.12, fontSize: 14, valign: "middle", paraSpaceAfter: 3 });
    });
    card(s, 8.25, 1.6, 4.48, 3.95, C.text2);
    txt(s, "WPCの差別化（仮説）", { x: 8.45, y: 1.72, w: 4.1, h: 0.45, fontSize: 19, bold: true, color: C.background1 });
    txt(s, bullets(["訪問日程と頻度を約束できる", "同じ従業員を年間で追いかける", "PTが一人ひとりの運動を調整", "勤務・シフトに合わせて運営", "本人と企業の報告を分ける"]), { x: 8.45, y: 2.25, w: 4.1, h: 3.1, fontSize: 17, color: C.background1, paraSpaceAfter: 6 });
    caution(s, "要検証", "「無料で専門職の支援が受けられるのに、なぜ年額を払うのか」に答えられるかが鍵。要素ひとつずつは真似されやすく、地域密着だけでは有料化の根拠になりません", 5.72, 1.15, { fs: 16 });
    note(s, `
競合と代替手段です。一番の比較相手は、実は無料の公的支援です。岩手産業保健総合支援センターは、理学療法士などを企業へ派遣し、体力やバランスの確認、運動指導、職場環境への助言を無料で行っています。盛岡市の出前講座や、岩手県よぼういがく協会の健康講座・保健師の定期訪問もあります。
全国の事業者では、NCSが10名・2時間で税込55,000円から、コナミスポーツが4時間・最大100名で税込385,000円などの公開価格を掲げています。ただし内容や条件が違うので、単純に比べたり平均して相場としたりはしません。社内体操や現状維持も、企業にとっては有力な選択肢です。
WPCの差別化は、訪問日程と頻度を約束できること、同じ従業員を年間で追いかけること、PTが運動を個別に調整すること、勤務に合わせた運営、本人と企業の報告を分けることですが、すべて仮説です。
「無料で専門職の支援が受けられるのに、なぜ年額を払うのか」に答えられるかが鍵です。営業ではまず、企業がこれら無料支援を使ったことがあるかを確認します。`);
  }

  {
    const s = content(4, "営業の進め方と、最初の目標");
    const funnel = [["セミナー・課題ヒアリング", 11.0], ["本部と現場の条件確認", 9.6], ["条件付きの見積", 8.2], ["有料パイロット（1法人）", 6.8], ["年間契約", 5.4], ["同じ企業の別拠点へ", 4.0]];
    funnel.forEach(([h, w], i) => {
      const y = 1.6 + i * 0.62;
      const x = 0.6 + (11.0 - w) / 2 * 0.62;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: w * 0.62, h: 0.54, fill: { color: i === 3 ? C.accent2 : C.text2 }, line: { type: "none" }, rectRadius: 0.08, objectName: "funnel" });
      txt(s, h, { x, y, w: w * 0.62, h: 0.54, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    card(s, 7.75, 1.6, 4.98, 3.65);
    txt(s, "最初の90日の目標（案）", { x: 7.95, y: 1.7, w: 4.6, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    const goals = [["決裁者との面談", "8〜10法人"], ["条件付きの見積", "3法人"], ["有料発注", "1法人以上"]];
    goals.forEach(([h, v], i) => {
      const y = 2.25 + i * 0.95;
      txt(s, h, { x: 7.95, y, w: 2.6, h: 0.8, fontSize: 17, valign: "middle" });
      txt(s, v, { x: 10.3, y, w: 2.3, h: 0.8, fontSize: 26, bold: true, color: C.accent2, valign: "middle", align: "right" });
    });
    txt(s, "面談数：第4版は8件以上、経営判断案は10法人", { x: 7.95, y: 4.95, w: 4.6, h: 0.3, fontSize: 12, color: GRAY });
    frame(s, 0.6, 5.45, 12.13, 0.9, C.accent6);
    txt(s, [{ text: "2026年11月4日時点：面談・見積・発注はいずれも0件。", options: { bold: true, color: C.accent6 } }, { text: "優先候補4社（食品製造2・物流1・ホテル1）や小売7法人は、すべて「営業候補」で、契約済みではありません" }], { x: 0.85, y: 5.45, w: 11.7, h: 0.9, fontSize: 16, valign: "middle" });
    glossary(s, "有料パイロット＝本格販売の前に、1つの企業で小規模に有料で試すこと", 6.45);
    note(s, `
営業の進め方です。セミナーや課題のヒアリングから始め、本部と現場の両方で条件を確認し、条件付きの見積を出し、1つの企業で有料パイロットを行い、年間契約、そして同じ企業の別の拠点へ広げる、という流れです。有料パイロットとは、本格販売の前に1つの企業で小規模に、有料で試すことです。
最初の90日の目標案は、決裁者との面談8〜10法人、条件付きの見積3法人、有料発注1法人以上です。面談数は、第4版では8件以上、経営判断案では10法人と、資料によって少し違います。
ここが一番誤解されやすいところなので強調します。11月4日時点で、面談・見積・発注はいずれも0件です。優先候補4社や小売の7法人は、あくまで営業の候補で、契約済みでも導入意向が確認できたわけでもありません。社外で候補企業の名前を出さないでください。
また、担当者の好意的な反応や無料参加の満足は、お金を払う意思の証拠とは扱いません。`);
  }

  // ===== 第5章 =====
  section("第5章 お金の話");
  {
    const s = content(5, "収益の仕組み：料金を払うのは企業");
    card(s, 0.6, 1.75, 3.6, 2.5);
    await iconCircle(s, md.MdBusiness, 1.9, 1.88, 1.0);
    txt(s, "企業（本部）", { x: 0.7, y: 2.95, w: 3.4, h: 0.45, fontSize: 21, bold: true, color: C.text2, align: "center" });
    txt(s, "従業員の参加時間も負担する", { x: 0.8, y: 3.45, w: 3.2, h: 0.7, fontSize: 16, align: "center" });
    card(s, 9.13, 1.75, 3.6, 2.5, C.text2);
    await iconCircle(s, md.MdHealthAndSafety, 10.43, 1.88, 1.0, C.accent2);
    txt(s, "Buddyship（WPC）", { x: 9.2, y: 2.95, w: 3.46, h: 0.45, fontSize: 21, bold: true, color: C.background1, align: "center" });
    txt(s, "スタッフの時間・交通・保険などの費用がかかる", { x: 9.33, y: 3.45, w: 3.2, h: 0.75, fontSize: 16, color: C.background1, align: "center" });
    arrowR(s, 4.35, 1.95, 4.65, 0.75, C.accent2);
    txt(s, "年間契約の料金を支払う", { x: 4.55, y: 1.95, w: 4.25, h: 0.75, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
    s.addShape(pres.shapes.LEFT_ARROW, { x: 4.35, y: 3.25, w: 4.65, h: 0.75, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "arrow" });
    txt(s, "測定・個別指導・集計報告", { x: 4.55, y: 3.25, w: 4.25, h: 0.75, fontSize: 18, bold: true, color: C.text2, align: "center", valign: "middle" });
    const eq = [["売上", "企業から受け取る料金", C.accent2], ["−", "", null], ["費用", "提供にかかるお金", C.accent4], ["=", "", null], ["利益", "会社に残るお金", C.accent5]];
    let x = 1.3;
    for (const [a, b, col] of eq) {
      if (!col) { txt(s, a, { x, y: 4.6, w: 0.6, h: 1.1, fontSize: 36, bold: true, color: C.text2, align: "center", valign: "middle" }); x += 0.6; continue; }
      card(s, x, 4.6, 3.0, 1.1, col);
      txt(s, [{ text: a, options: { fontSize: 24, bold: true, breakLine: true } }, { text: b, options: { fontSize: 16 } }], { x, y: 4.6, w: 3.0, h: 1.1, color: C.background1, align: "center", valign: "middle" });
      x += 3.0;
    }
    txt(s, "WPCは人が1人ずつ対応するサービス。人数が増えると、時間と人件費も比例して増えます。売上が増えても利益が出るとは限りません", { x: 0.6, y: 5.95, w: 12.13, h: 0.75, fontSize: 17 });
    note(s, `
第5章、お金の話です。まず収益の仕組みです。企業、具体的には本部が年間契約の料金を支払い、Buddyshipは測定、個別指導、集計報告を提供します。
ただし企業は料金だけでなく、従業員が勤務中に参加する時間も負担しています。私たちの側にも、スタッフの時間、交通費、消耗品、保険などの費用がかかります。
下の式が基本です。売上から費用を引いたものが利益です。WPCは人が1人ずつ対応するサービスなので、人数が増えると時間と人件費もほぼ比例して増えます。売上が増えても、費用がそれ以上に増えれば利益は出ません。この点が、次の価格の話につながります。`);
  }

  {
    const s = content(5, "価格は未確定：3つの案が並んでいる");
    s.addChart(pres.charts.BAR, [
      { name: "売上", labels: ["3,000円/人回", "6,000円/人回"], values: [48, 96] },
      { name: "提供で増える費用", labels: ["3,000円/人回", "6,000円/人回"], values: [70, 70] },
    ], chartBase({
      x: 0.6, y: 1.55, w: 6.4, h: 3.95, barDir: "col", barGrouping: "clustered", chartColors: [HEX.accent2, HEX.accent4],
      title: "40人・2拠点・年4回の場合（万円/年）", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0",
      valAxisMinVal: 0, valAxisMaxVal: 120, valAxisMajorUnit: 20, showLegend: true, legendPos: "b",
    }));
    txt(s, "費用は経営判断案・財務モデルの定常計算（職員の時間も含む）の約70万円", { x: 0.6, y: 5.5, w: 6.4, h: 0.35, fontSize: 12, color: GRAY, align: "center" });
    txt(s, [{ text: "限界利益　", options: { bold: true } }, { text: "3,000円 ▲22万円", options: { bold: true, color: C.accent6 } }, { text: "／" }, { text: "6,000円 ＋26万円", options: { bold: true, color: C.accent5 } }], { x: 0.6, y: 5.88, w: 6.4, h: 0.45, align: "center" });
    const cards = [
      ["3,000円/人回", "第4版正本の価格仮説。20人・年3回で年18万円/拠点。1人30分・20分の枠では約▲0.4万円/拠点"],
      ["6,000円/人回", "経営判断案・財務モデル。40人2拠点・年4回で年96万円（年3回なら76万円）"],
      ["6,500円/人回相当", "追補。20人1拠点・年4回で年52万円（条件が違うため左の図に入れていない）"],
    ];
    cards.forEach(([h, d], i) => {
      const y = 1.55 + i * 1.3;
      card(s, 7.3, y, 5.43, 1.15);
      txt(s, h, { x: 7.5, y: y + 0.08, w: 3.0, h: 0.4, fontSize: 19, bold: true, color: C.text2 });
      txt(s, d, { x: 7.5, y: y + 0.46, w: 5.15, h: 0.66, fontSize: 14.5 });
    });
    frame(s, 7.3, 5.45, 5.43, 0.9);
    txt(s, "監査：「3,000円は撤回し、6,000円前後を軸に3つの価格で支払意思を確かめる」ことを提案。決定はまだ", { x: 7.45, y: 5.45, w: 5.2, h: 0.9, fontSize: 15, valign: "middle" });
    glossary(s, "限界利益＝売上から提供に伴って増える費用を引いた利益　／　円/人回＝参加者1人・1回あたりの料金", 6.45);
    note(s, `
価格です。結論から言うと、価格はまだ決まっていません。資料によって3つの案が並んでいます。「円/人回」は参加者1人・1回あたりの料金という意味です。
3,000円は事業計画書第4版の価格仮説です。6,000円は経営判断案と財務モデルが使っている、40人・2拠点・年4回で年96万円の案です。6,500円相当は追補の、20人・1拠点・年4回で年52万円の案です。
左のグラフは、条件をそろえられる2案だけを比べています。40人・2拠点・年4回で、提供に伴って増える費用を約70万円とすると、3,000円では売上48万円で限界利益は22万円の赤字、6,000円なら26万円の黒字です。限界利益は、売上から提供に伴って増える費用を引いたもので、会社の固定費はここから払います。6,500円案は条件が違うので同じグラフには入れず、優劣も判断していません。
第4版の3,000円は、測定枠を1人30分・再評価20分に延ばして計算し直すと、20人・年3回の1拠点で約3,900円の赤字になります。
監査は3,000円の撤回と、6,000円前後を軸に3つの価格で支払意思を確かめることを提案していますが、まだ決定ではありません。責任者が一本化するまで、社外に単価を伝えないでください。`);
  }

  {
    const s = content(5, "1契約の中身：96万円は何に使われるか（試算）");
    s.addChart(pres.charts.BAR, [
      { name: "現場と報告の人件費", labels: ["3名体制"], values: [57.6] },
      { name: "交通・消耗品 4.8", labels: ["3名体制"], values: [4.8] },
      { name: "機器の使用分 1.6", labels: ["3名体制"], values: [1.6] },
      { name: "契約の調整・支援 6.0", labels: ["3名体制"], values: [6.0] },
      { name: "限界利益", labels: ["3名体制"], values: [26.0] },
    ], chartBase({
      x: 0.6, y: 1.55, w: 12.13, h: 2.25, barDir: "bar", barGrouping: "stacked",
      chartColors: [HEX.dk2, HEX.accent3, "9FB6CF", HEX.accent4, HEX.accent5],
      title: "年4回・40人・2拠点、売上96万円の内訳（万円/年）", showValue: true, dataLabelPosition: "ctr", dataLabelColor: "FFFFFF", dataLabelFontSize: 14, dataLabelFormatCode: "[>=5]0.0;\"\"",
      valAxisMinVal: 0, valAxisMaxVal: 96, valAxisMajorUnit: 12, showLegend: true, legendPos: "b", catAxisLabelFontSize: 14,
    }));
    const facts = [
      ["7社", "定常の固定費（年176万円）を回収できる契約数", C.text2],
      ["9.6社", "今の開催枠（月8日×80%）で受けられる上限", C.accent2],
      ["9.2万円", "4名体制にした場合の1契約の限界利益", C.accent4],
    ];
    facts.forEach(([v, d, col], i) => {
      const x = 0.6 + i * 4.12;
      card(s, x, 4.0, 3.88, 1.75);
      txt(s, v, { x: x + 0.2, y: 4.08, w: 3.5, h: 0.8, fontSize: 36, bold: true, color: col });
      txt(s, d, { x: x + 0.2, y: 4.9, w: 3.5, h: 0.8, fontSize: 16 });
    });
    caution(s, "試算", "経営判断案Ver.1.0（正本ではない）の仮定：職員の時間を1時間3,000円で評価、3名×7時間＋報告3時間＝1開催日24人時、8開催日。黒字にできる範囲（7〜9.6社）がとても狭いのが特徴", 5.95, 1.0, { fs: 15 });
    note(s, `
1契約の中身を見てみます。経営判断案Ver.1.0の試算で、正本ではありませんが、費用の構造がよく分かります。年4回・40人・2拠点、売上96万円の場合です。
一番大きいのは現場と報告の人件費で57.6万円。これは3名が7時間ずつ、報告に3時間、1開催日あたり24人時を、1時間3,000円で評価し、8開催日分を積み上げたものです。交通・消耗品が4.8万円、機器の使用分が1.6万円、契約の調整と支援が6万円。残りの26万円が限界利益です。
下の3つの数字に注目してください。会社の定常の固定費、年176万円を回収するには、この契約が7社必要です。一方、今の開催枠、月8日の80%で受けられるのは9.6社分が上限です。つまり黒字にできる範囲が7社から9.6社と、とても狭いのです。さらに、安全のために4名体制にすると、1契約の限界利益は9.2万円まで下がります。
このため、職員の時間をどう確保するか、価格をいくらにするかが、事業が成り立つかどうかの分かれ目になります。`);
  }

  {
    const s = content(5, "3年間の試算：2つの物差しで結果が変わる");
    s.addChart(pres.charts.BAR, [
      { name: "会社の増分キャッシュフロー", labels: ["保守", "基準", "楽観（強気）"], values: [55.7, 733.2, 1415.8] },
      { name: "管理会計上の損益（職員の時間を費用に含む）", labels: ["保守", "基準", "楽観（強気）"], values: [-859.6, -342.8, 13.7] },
    ], chartBase({
      x: 0.6, y: 1.55, w: 7.2, h: 4.8, barDir: "col", barGrouping: "clustered", chartColors: [HEX.accent2, HEX.accent4],
      title: "36か月の累計（2026年11月〜2029年10月、万円）", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0;▲#,##0",
      catAxisLabelPos: "low", valAxisMinVal: -1000, valAxisMaxVal: 1600, valAxisMajorUnit: 500, valAxisLabelFormatCode: "#,##0;▲#,##0", showLegend: true, legendPos: "b",
    }));
    card(s, 8.1, 1.55, 4.63, 1.75);
    txt(s, [{ text: "増分キャッシュフロー", options: { bold: true, color: C.accent2, breakLine: true, fontSize: 19 } }, { text: "WPCを始めることで会社の現金がいくら増えるか。既存職員の給与は払い済みなので含めない", options: { fontSize: 15 } }], { x: 8.3, y: 1.65, w: 4.3, h: 1.6 });
    card(s, 8.1, 3.45, 4.63, 1.75);
    txt(s, [{ text: "管理会計上の損益", options: { bold: true, color: C.accent4, breakLine: true, fontSize: 19 } }, { text: "職員がWPCに使った時間も人件費として計算した、事業そのものの損益", options: { fontSize: 15 } }], { x: 8.3, y: 3.55, w: 4.3, h: 1.6 });
    frame(s, 8.1, 5.35, 4.63, 1.0);
    tag(s, "試算", 8.25, 5.67, 0.85);
    txt(s, "財務モデルVer.1.1。年4回40人で96万円などの未確定の仮定にもとづく", { x: 9.2, y: 5.35, w: 3.45, h: 1.0, fontSize: 14, valign: "middle" });
    txt(s, "基準ケースは現金が約733万円増える一方、職員の時間を含めると約343万円の赤字。差の約1,076万円が職員の時間の価値です", { x: 0.6, y: 6.45, w: 12.13, h: 0.55, fontSize: 16, bold: true, color: C.text2 });
    note(s, `
3年間の試算です。財務モデルVer.1.1では、保守・基準・楽観――モデル上の名前は「強気」――の3つのシナリオで、2026年11月から36か月間を計算しています。グラフは36か月の累計で、実績ではありません。
同じ事業でも、2つの物差しで結果が大きく変わります。青の「増分キャッシュフロー」は、WPCを始めることで会社の現金がいくら増えるかで、既存職員の給与はもともと払っているので含めません。基準ケースでは約733万円の増加です。
オレンジの「管理会計上の損益」は、職員がWPCに使った時間も人件費として計算した、事業そのものの損益です。基準ケースでは約343万円の赤字、保守では約860万円の赤字で、黒字は楽観ケースだけです。
差の約1,076万円が、既存職員の時間の価値です。職員に本当に空き時間があれば現金は増えますが、空き時間がなければこの前提は崩れます。監査は、勤務表で空き時間を確認するまで、現金の増加だけを判断材料にしないよう求めています。`);
  }

  {
    const s = content(5, "基準ケースの年ごとの推移");
    s.addChart(pres.charts.BAR, [
      { name: "売上", labels: ["1年目", "2年目", "3年目"], values: [96.0, 364.8, 627.8] },
      { name: "会社の増分キャッシュフロー", labels: ["1年目", "2年目", "3年目"], values: [49.2, 243.8, 440.2] },
      { name: "管理会計上の損益", labels: ["1年目", "2年目", "3年目"], values: [-162.0, -109.7, -71.1] },
    ], chartBase({
      x: 0.6, y: 1.55, w: 7.6, h: 4.85, barDir: "col", barGrouping: "clustered", chartColors: [HEX.dk2, HEX.accent2, HEX.accent4],
      title: "基準ケース（万円、各年11月〜翌10月）", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0.0;▲#,##0.0", dataLabelFontSize: 12,
      catAxisLabelPos: "low", valAxisMinVal: -200, valAxisMaxVal: 700, valAxisMajorUnit: 100, valAxisLabelFormatCode: "#,##0;▲#,##0", showLegend: true, legendPos: "b",
    }));
    const facts = [["新規契約", "1年目2社・2年目3社・3年目4社、更新率80%を仮定"], ["価格", "年96万円（年4回・40人・2拠点）"], ["準備資金の目安", "約29万円（実際に使える資金は未確認）"], ["税金", "未入力（税引前）"]];
    facts.forEach(([h, d], i) => {
      const y = 1.55 + i * 1.12;
      card(s, 8.45, y, 4.28, 0.98);
      txt(s, h, { x: 8.65, y: y + 0.06, w: 3.9, h: 0.4, fontSize: 16, bold: true, color: C.accent2 });
      txt(s, d, { x: 8.65, y: y + 0.45, w: 3.95, h: 0.5, fontSize: 15 });
    });
    txt(s, "売上が伸びても、職員の時間を含めた損益は3年目まで赤字の試算。旧資料の必要資金336.7万円は前提が違うため使いません", { x: 0.6, y: 6.45, w: 12.13, h: 0.55, fontSize: 16, bold: true, color: C.text2 });
    note(s, `
基準ケースを年ごとに見ます。財務モデルVer.1.1の年次の数字です。
売上は1年目96万円、2年目約365万円、3年目約628万円と伸びる計算です。会社の増分キャッシュフローは49万円、244万円、440万円。一方、職員の時間を含めた管理会計上の損益は、▲162万円、▲110万円、▲71万円と、3年目まで赤字のままです。
前提は、新規契約が1年目2社・2年目3社・3年目4社、更新率80%、価格は年96万円です。いずれも受注の実績ではなく仮定です。準備資金の目安は約29万円とされていますが、実際に割り当てる資金や税金は未確認です。
なお、旧資料には必要資金336.7万円という数字がありますが、職員の時間をすべて現金で払う前提での計算で、今の方針とは前提が違うため使いません。`);
  }

  {
    const s = content(5, "パイロットの費用と価格は、まだ一致していない");
    s.addChart(pres.charts.BAR, [
      { name: "人件費", labels: ["1時間3,000円", "4,500円", "6,000円"], values: [127.2, 190.8, 254.4] },
      { name: "その他（機器・会場・交通・保険など）", labels: ["1時間3,000円", "4,500円", "6,000円"], values: [22.2, 22.2, 22.2] },
    ], chartBase({
      x: 0.6, y: 1.55, w: 6.6, h: 4.3, barDir: "col", barGrouping: "stacked", chartColors: [HEX.dk2, "7F97B2"],
      title: "80人・2拠点・2回（初回＋3か月後）の費用試算（万円）", showValue: true, dataLabelPosition: "ctr", dataLabelColor: "FFFFFF", dataLabelFormatCode: "0.0",
      valAxisMinVal: 0, valAxisMaxVal: 300, valAxisMajorUnit: 50, showLegend: true, legendPos: "b",
    }));
    txt(s, "合計 149.4／213.0／276.6万円（424人時：8開催日×5人）", { x: 0.6, y: 5.9, w: 6.6, h: 0.4, fontSize: 15, bold: true, color: C.text2, align: "center" });
    const pc = [
      ["第4版", "2店舗・40人・2回で 24万円", "第4版自身の原価は18.9万円だが、時間延長後は23.6万円"],
      ["経営判断案", "40人・2拠点・2回で 40〜48万円", "直接原価約35万円＋追加検証費"],
      ["最新プロトコル案", "80人・2拠点で 約149〜277万円の費用", "5人体制・8開催日。価格は示されていない"],
      ["監査", "1法人・40人以下・原価を回収できる価格", "24万円なら約11万円の赤字と指摘"],
    ];
    pc.forEach(([h, a, b], i) => {
      const y = 1.55 + i * 1.15;
      card(s, 7.45, y, 5.28, 1.02);
      txt(s, h, { x: 7.6, y: y + 0.06, w: 2.0, h: 0.4, fontSize: 15, bold: true, color: C.accent2 });
      txt(s, a, { x: 7.6, y: y + 0.38, w: 5.0, h: 0.35, fontSize: 15, bold: true, color: C.text2 });
      txt(s, b, { x: 7.6, y: y + 0.7, w: 5.0, h: 0.3, fontSize: 12, color: GRAY });
    });
    caution(s, "未確定", "規模（40人か80人か）・体制・価格がそろっていません。条件の違う数字どうしを比べて「黒字・赤字」を判断しないこと", 6.35, 0.62, { fs: 15 });
    note(s, `
パイロットの費用と価格です。ここは資料間のずれが最も大きいところです。
左のグラフは、最新の測定プロトコル案Ver.4.1の試算です。2拠点・各40人、合計80人を、初回と約3か月後の2回測る計画で、5人体制で8開催日、合計424人時かかります。人件費を1時間3,000円、4,500円、6,000円で見ると、その他の費用22.2万円と合わせて、約149万円、213万円、277万円になります。これは原価の例で、販売価格ではありません。
一方、価格の案は、第4版が2店舗・40人で24万円、経営判断案が40人で40〜48万円です。監査は、40人以下・原価を回収できる価格で行うよう求め、24万円では約11万円の赤字になると指摘しています。
つまり、規模が40人か80人か、体制が何人か、価格がいくらかが、まだそろっていません。条件の違う数字同士を比べて、黒字か赤字かを判断しないようにしてください。開始前に責任者が1つの仕様に決めます。`);
  }

  // ===== 第6章 =====
  section("第6章 体制と安全");
  {
    const s = content(6, "測定日の体制（案）：1拠点に2つの測定列と受付");
    const flow = [["受付", "本人確認・同意"], ["安静・質問票", "座って5分以上"], ["安全確認", "症状・血圧"], ["測定列", "身体4項目"], ["個別説明", "結果・運動"], ["退出", "清拭・照合"]];
    flow.forEach(([h, d], i) => {
      const x = 0.6 + i * 2.05;
      s.addShape(i === 3 ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 1.8, h: 1.05, fill: { color: i === 3 ? C.accent2 : C.text2 }, line: { type: "none" }, rectRadius: 0.1, objectName: "booth" });
      txt(s, [{ text: h, options: { bold: true, breakLine: true, fontSize: 17 } }, { text: d, options: { fontSize: 13 } }], { x, y: 1.6, w: 1.8, h: 1.05, color: C.background1, align: "center", valign: "middle" });
      if (i < 5) arrowR(s, x + 1.83, 1.95, 0.2, 0.35);
    });
    txt(s, "一方通行の動線。待っている人が測定の場所を横切らないようにする", { x: 0.6, y: 2.72, w: 12.13, h: 0.35, fontSize: 14, color: GRAY });
    const lanes = [["測定列1", "A 測定担当（PT等）", "B 補助・計時"], ["測定列2", "A 測定担当（PT等）", "B 補助・計時"]];
    lanes.forEach(([h, a, b], i) => {
      const x = 0.6 + i * 3.4;
      card(s, x, 3.25, 3.2, 2.0);
      txt(s, h, { x: x + 0.2, y: 3.32, w: 2.8, h: 0.42, fontSize: 18, bold: true, color: C.accent2 });
      txt(s, bullets([a, b]), { x: x + 0.2, y: 3.8, w: 2.9, h: 1.35, fontSize: 16, paraSpaceAfter: 8 });
    });
    card(s, 7.4, 3.25, 2.3, 2.0);
    txt(s, [{ text: "C 受付", options: { bold: true, color: C.accent2, breakLine: true, fontSize: 18 } }, { text: "予約・本人確認・問い合わせ・緊急時の通報", options: { fontSize: 15 } }], { x: 7.55, y: 3.32, w: 2.05, h: 1.85 });
    card(s, 9.9, 3.25, 2.83, 2.0, C.text2);
    txt(s, [{ text: "計5人", options: { bold: true, fontSize: 32, breakLine: true } }, { text: "1日20人（1列10人）\n40人の拠点は2日に分ける", options: { fontSize: 15 } }], { x: 10.05, y: 3.32, w: 2.6, h: 1.85, color: C.background1 });
    caution(s, "未確定", "体制は資料によって「PT1人で1対1」（第4版）、「3名×7時間」（経営判断案）、「2列5人」（最新案）と異なり、原価が2〜3倍変わります。補助者が欠けたらその列は閉じます", 5.45, 1.0, { fs: 15 });
    glossary(s, "測定列＝測定を行う1つのブース。測定担当と補助担当の2人1組で運営する", 6.5);
    note(s, `
第6章、体制と安全です。最新の案では、1つの拠点に測定を行うブース、つまり「測定列」を2つと受付を置き、合計5人で運営します。
参加者は、受付で本人確認と同意の確認をし、座って5分以上の安静と質問票、安全確認と血圧、測定列での身体4項目、個別の結果説明と運動指導、退出、と一方通行で進みます。待っている人が測定の場所を横切らないようにします。
各測定列は、PTなどの測定担当Aと、補助・計時を担当するBの2人1組です。受付のCは、予約、本人確認、問い合わせ、緊急時の通報を担当します。1日に20人、1列10人を測るので、40人の拠点は2日に分けます。
ただし体制は資料によって、第4版の「PT1人で1対1」、経営判断案の「3名×7時間」、最新案の「2列5人」と異なり、原価が2〜3倍変わります。どれにするかは未確定です。安全のため、補助者が欠けたらその列は閉じる、というルールです。`);
  }

  {
    const s = content(6, "社員が担う役割（仮案）");
    const roles = [
      [md.MdHandshake, "営業", "本部との面談・見積"], [md.MdSchedule, "事前調整", "参加枠・会場・シフト"], [fa.FaPersonWalking, "測定", "PTが体調確認と測定"],
      [md.MdHealthAndSafety, "安全補助", "転倒防止・計時"], [md.MdEditNote, "記録", "入力と二者照合"], [md.MdAssessment, "報告", "集計・開示審査"], [md.MdBadge, "事務", "予約・請求・連絡"],
    ];
    for (const [i, [ic, h, d]] of roles.entries()) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 0.6 + col * 3.08, y = 1.6 + row * 1.42;
      card(s, x, y, 2.9, 1.25);
      await iconCircle(s, ic, x + 0.15, y + 0.25, 0.75, i === 2 || i === 3 ? C.accent2 : C.text2);
      txt(s, h, { x: x + 1.05, y: y + 0.15, w: 1.8, h: 0.45, fontSize: 19, bold: true, color: C.text2 });
      txt(s, d, { x: x + 1.05, y: y + 0.6, w: 1.8, h: 0.55, fontSize: 14 });
    }
    card(s, 9.84, 3.02, 2.89, 1.25, C.text2);
    txt(s, "担当者・人数は未定", { x: 9.95, y: 3.02, w: 2.7, h: 1.25, fontSize: 17, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "開始前に任命が必要な責任者（監査・品質管理案）", { x: 0.6, y: 4.5, w: 12, h: 0.42, fontSize: 18, bold: true, color: C.text2 });
    const owners = [["事業責任者", "価格・契約・開始判断"], ["医療安全責任者", "安全基準・救急・再開判断"], ["情報管理責任者", "同意・保管・開示"], ["統計・データ責任者", "集計・Excel・解析"]];
    owners.forEach(([h, d], i) => {
      const x = 0.6 + i * 3.08;
      frame(s, x, 5.0, 2.9, 1.15, C.accent3);
      txt(s, [{ text: h, options: { bold: true, breakLine: true, color: C.text2 } }, { text: d, options: { fontSize: 14 } }], { x: x + 0.15, y: 5.05, w: 2.65, h: 1.05, fontSize: 17, valign: "middle" });
    });
    txt(s, "皆さんに具体的な役割をお願いするときは、デイサービスの勤務への影響を確認したうえで個別に相談します", { x: 0.6, y: 6.35, w: 12.13, h: 0.55, fontSize: 16, color: C.accent4 });
    note(s, `
社員の皆さんが担う役割の仮案です。営業は本部との面談と見積、事前調整は参加枠・会場・シフトの調整。当日は、PTが体調確認と測定を、別のスタッフが転倒防止や計時などの安全補助を担います。終わった後は記録の入力と二者照合、集計と開示審査をした報告、予約・請求・連絡などの事務があります。誰が担当するか、何人で回すかはまだ決まっていません。
また、開始前には4つの責任者を任命する必要があります。価格・契約・開始判断を担う事業責任者、安全基準や救急、事故後の再開判断を担う医療安全責任者、同意・保管・開示を担う情報管理責任者、集計・Excel・解析を担う統計・データ責任者です。今は全員が未任命で、各文書の承認欄はすべて空欄です。
皆さんに役割をお願いするときは、デイサービスの勤務への影響を確認したうえで、個別にご相談します。`);
  }

  {
    const s = content(6, "デイサービスとの関係：人員基準を守ることが最優先");
    s.addShape(pres.shapes.OVAL, { x: 0.8, y: 1.75, w: 4.0, h: 3.5, fill: { color: C.text2, transparency: 5 }, line: { type: "none" }, objectName: "day" });
    s.addShape(pres.shapes.OVAL, { x: 3.5, y: 1.75, w: 4.0, h: 3.5, fill: { color: C.accent2, transparency: 25 }, line: { type: "none" }, objectName: "wpc" });
    txt(s, "デイサービス\n（既存事業）", { x: 1.0, y: 2.9, w: 2.3, h: 1.0, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "WPC\n（新規事業）", { x: 5.1, y: 2.9, w: 2.2, h: 1.0, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "同じ\n職員の\n時間", { x: 3.55, y: 2.75, w: 1.2, h: 1.4, fontSize: 17, bold: true, color: C.background1, align: "center", valign: "middle" });
    txt(s, "当面は新しく人を雇わず、デイサービスの職員が兼務する方針。職員が企業へ出かけると、デイサービスの配置が手薄になるおそれ", { x: 0.6, y: 5.35, w: 7.0, h: 0.95, fontSize: 16 });
    const chk = [
      ["人員基準・加算を守れるか", "要確認", "機能訓練指導員のPT等が抜けると加算を算定できず、返還の対象になるおそれ"],
      ["盛岡市（指定権者）へ照会", "未完了", "配置・加算の扱いを事前に確認する"],
      ["兼務時間を勤務表で確認", "未完了", "WPCには配置基準の外の職員・時間だけを充てる案"],
    ];
    chk.forEach(([h, t, d], i) => {
      const y = 1.65 + i * 1.5;
      card(s, 7.9, y, 4.83, 1.3);
      txt(s, h, { x: 8.1, y: y + 0.1, w: 3.35, h: 0.55, bold: true, color: C.text2, valign: "middle" });
      tag(s, t, 11.55, y + 0.15, 1.05, t === "未完了" ? "accent6" : "accent4");
      txt(s, d, { x: 8.1, y: y + 0.68, w: 4.5, h: 0.58, fontSize: 14 });
    });
    glossary(s, "人員基準＝介護保険の職員配置の決まり／加算＝要件を満たすと上乗せされる報酬／指定権者＝盛岡市", 6.45);
    note(s, `
デイサービスとの関係です。事業の前提そのものに関わる、とても重要な点です。
WPCは当面、新しく人を雇わず、デイサービスの職員が兼務する方針です。つまり、デイサービスとWPCは「同じ職員の時間」を分け合います。
デイサービスには、介護保険で定められた職員配置の決まり、「人員基準」があります。また個別機能訓練加算などの「加算」には、機能訓練指導員のPT等が専らその仕事に従事する、といった要件があります。営業時間中にPTが企業へ出かけると要件を満たせず、加算が算定できなくなったり、運営指導で返還の対象になったりするおそれがあると、監査が最も重い課題の一つとして指摘しました。
そのため、事業所を指定・指導する盛岡市への事前照会と、勤務表で兼務できる時間の確認が必要ですが、どちらもまだ完了していません。監査は、WPCに充てるのは配置基準の外の職員・時間帯に限るべきと提案しています。
デイサービスへの影響額も、資料により月3万円の減収と、1開催日5,000円という異なる仮定があり、未確定です。皆さんへのお願いは、デイサービスの利用者さんと人員基準を最優先にすることです。`);
  }

  {
    const s = content(6, "個人情報を守る：同意は4つに分けて確認する");
    const cons = [["サービスを受ける", "測定と結果説明。項目ごとに断れる"], ["研究に使う", "サービスとは別。必要な手続き後のみ"], ["勤怠記録とつなぐ", "期間・項目・取得元を明示"], ["後日の連絡", "目的と手段、終わる時点を決める"]];
    cons.forEach(([h, d], i) => {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.6, 2.9, 1.65);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.15, y: 1.75, w: 0.42, h: 0.42, fill: { color: C.background1 }, line: { color: C.accent2, width: 2 }, rectRadius: 0.05, objectName: "checkbox" });
      txt(s, h, { x: x + 0.7, y: 1.72, w: 2.1, h: 0.5, fontSize: 18, bold: true, color: C.text2, valign: "middle" });
      txt(s, d, { x: x + 0.15, y: 2.35, w: 2.65, h: 0.85, fontSize: 15 });
    });
    const rules = [
      ["参加は任意", "断っても、途中でやめても不利益はない。人事評価に使わない"],
      ["企業へは集計のみ", "個人の値は渡さない。10人未満は原則非表示、差し引きで分かる場合も伏せる"],
      ["安全な保管", "業務用の環境で、アクセス制限・多要素認証・操作記録。対応表は別に保管"],
      ["AIや外部へ入れない", "実際の健康データを、AIの支援作業や試験環境に入力しない"],
    ];
    rules.forEach(([h, d], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 3.45 + row * 1.25;
      card(s, x, y, 5.96, 1.1);
      txt(s, h, { x: x + 0.2, y: y + 0.06, w: 5.6, h: 0.42, fontSize: 18, bold: true, color: C.text2 });
      txt(s, d, { x: x + 0.2, y: y + 0.48, w: 5.6, h: 0.6, fontSize: 14 });
    });
    caution(s, "未完了", "健康データのExcelが個人のPCに保存されている点は移行が必要（監査）。情報の預かり方の法的な構造、保存期限と削除日も未確定です", 6.0, 0.9, { kind: "accent6", fs: 15 });
    note(s, `
個人情報を守る仕組みです。まず同意は4つに分けて確認します。サービスとして測定と結果説明を受けること、研究に使うこと、勤怠記録とつなぐこと、後日連絡を受けること、の4つです。サービスに同意しても、研究への同意とは扱いません。研究として行う場合は、2026年12月から適用される改正倫理指針にもとづき、倫理審査が必要かを判断します。
ルールは4つです。参加は任意で、断っても途中でやめても不利益はなく、人事評価に使いません。企業へは集計のみで、10人未満は原則非表示です。保管は業務用の環境で、アクセス制限と多要素認証、操作記録を必須にし、氏名の対応表は別に保管します。そして、実際の健康データをAIの支援作業や試験環境に入力しません。
監査では、健康データのExcelを個人のパソコンに保存している点が指摘され、移行が必要です。また、WPCがどういう法的な立場で情報を預かるか、保存期限と削除日も未確定です。`);
  }

  // ===== 第7章 =====
  section("第7章 これから");
  {
    const s = content(7, "現在の進捗：どこまでできていて、何が残っているか");
    const cols = [
      ["作成済み（未承認を含む）", "accent5", md.MdCheckCircle, ["事業計画書 第4版", "財務モデル Ver.1.1（試算）", "KPI定義書・測定プロトコル（案）", "現場SOP・記録票（案）", "第三者監査の実施"]],
      ["設計中", "accent2", md.MdConstruction, ["価格・回数・体制の一本化", "測定セットの確定と模擬測定", "安全基準・救急体制の承認", "同意書・個人情報の規程", "Excelの修正と試験"]],
      ["未検証", "accent4", md.MdHelp, ["企業がお金を払うか", "1人35分（30分）で回るか", "体と仕事への効果", "デイとの兼務時間", "保険の条件と費用"]],
    ];
    for (const [i, [h, k, ic, items]] of cols.entries()) {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.6, 3.88, 4.65);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 3.88, h: 0.85, fill: { color: C[k] }, line: { type: "none" }, rectRadius: 0.12, objectName: "col head" });
      s.addImage({ data: await L.icon(ic, HEX.lt1), x: x + 0.2, y: 1.75, w: 0.55, h: 0.55, altText: h });
      txt(s, h, { x: x + 0.85, y: 1.6, w: 2.95, h: 0.85, fontSize: h.length > 8 ? 17 : 21, bold: true, color: C.background1, valign: "middle" });
      txt(s, bullets(items), { x: x + 0.25, y: 2.65, w: 3.5, h: 3.5, paraSpaceAfter: 10 });
    }
    txt(s, "面談・見積・発注は0件。商談・契約・測定・効果検証はまだ完了していません（11月4日時点）", { x: 0.6, y: 6.4, w: 12.13, h: 0.5, fontSize: 17, bold: true, color: C.text2 });
    note(s, `
第7章、これからの話です。まず現在の進捗を3つに分けました。
「作成済み」は、事業計画書第4版、財務モデル、KPI定義書と測定プロトコル、現場SOPと記録票、そして第三者監査です。ただし、財務モデル以外の多くは承認前の案です。
「設計中」は、価格・回数・体制の一本化、測定セットの確定と模擬測定、安全基準と救急体制の承認、同意書と個人情報の規程、Excelの修正と試験です。
「未検証」は、企業が本当にお金を払うか、1人35分で本当に回るか、体と仕事への効果、デイサービスとの兼務時間、保険の条件です。
まとめると、資料づくりはかなり進みましたが、商談、契約、測定、効果検証は、まだどれも完了していません。`);
  }

  {
    const s = content(7, "第三者監査で分かった、開始前に解決すべき課題");
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.6, w: 12.13, h: 0.8, fill: { color: C.text2 }, line: { type: "none" }, rectRadius: 0.12, objectName: "verdict" });
    txt(s, [{ text: "総合判定：条件付きで進めてよい。", options: { bold: true } }, { text: "ただし今の計画のままの開始は不可（No-Go）" }], { x: 0.85, y: 1.6, w: 11.7, h: 0.8, fontSize: 19, color: C.background1, valign: "middle" });
    const issues = [
      [md.MdPayments, "価格・採算", "価格案が3つ並存。3,000円では構造的に赤字。採算が職員の時間をほぼ無償とみなす前提に依存"],
      [md.MdElderly, "人員基準", "PT等の兼務で、デイサービスの人員基準・加算の要件を満たせなくなるおそれ"],
      [md.MdHealthAndSafety, "測定の安全性・妥当性", "転倒リスクのある測定なのに救急体制が未記入。ほぼ全員成功して差が出ない項目がある"],
      [md.MdLock, "個人情報管理", "情報の預かり方の法的な構造が未確定。健康データを個人PCに保存"],
    ];
    for (const [i, [ic, h, d]] of issues.entries()) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 2.6 + row * 1.75;
      card(s, x, y, 5.96, 1.58);
      await iconCircle(s, ic, x + 0.2, y + 0.22, 0.75, row === 0 ? C.accent6 : C.accent4);
      txt(s, h, { x: x + 1.1, y: y + 0.1, w: 4.7, h: 0.45, fontSize: 20, bold: true, color: C.text2 });
      txt(s, d, { x: x + 1.1, y: y + 0.55, w: 4.75, h: 1.0, fontSize: 15 });
    }
    card(s, 0.6, 6.15, 12.13, 0.82, C.background2);
    txt(s, [{ text: "このほか　", options: { bold: true, color: C.accent2 } }, { text: "企業の支払意思の証拠が0件で、地域には無料の公的支援がある点も「致命的」とされた。生産性はパイロットでは記述的に見るにとどめる" }], { x: 0.8, y: 6.15, w: 11.8, h: 0.82, fontSize: 15, valign: "middle" });
    note(s, `
2026年11月4日に、独立した第三者による監査を受けました。総合判定は「条件付きで進めてよい」。ただし「今の計画のままの開始は不可」、つまりNo-Goです。No-Goとは、進めてはいけない、という判定です。
課題は大きく4つです。1つ目、価格と採算。価格案が3つ並び、3,000円では構造的に赤字。採算は職員の時間をほぼ無償とみなす前提に依存しています。2つ目、人員基準。PT等の兼務でデイサービスの人員基準や加算の要件を満たせなくなるおそれ。3つ目、測定の安全性と妥当性。転倒リスクのある測定なのに救急体制が未記入で、ほぼ全員成功して差が出ない項目もあります。4つ目、個人情報管理。情報の預かり方の法的な構造が未確定で、健康データを個人のパソコンに保存しています。
このほか、企業の支払意思を示す証拠が0件で、地域に無料の公的支援がある点も「致命的」とされました。また、生産性はパイロットでは記述的に見るにとどめるよう求められています。`);
  }

  {
    const s = content(7, "開始までの関門：条件を満たした段階だけ先へ進む");
    const gates = [
      ["0", "文書の準備", "手順・記録票・判定票の案がそろう", "達成", "accent5"],
      ["1", "模擬測定", "職員等の協力者で通し練習。施設・救急・役割を承認", "未", "accent4"],
      ["2", "従業員パイロット", "承認台帳の必須項目（監査の10条件を含む）と安全・データ試験に合格", "未", "accent4"],
      ["3", "企業への報告", "照合・開示審査・表現の確認が完了", "未", "accent4"],
      ["4", "拡大", "パイロットの安全・時間・原価の実績で再評価", "未", "accent4"],
    ];
    gates.forEach(([n, h, d, st, k], i) => {
      const x = 0.6 + i * 2.47;
      const y = 3.6 - i * 0.42;
      card(s, x, y, 2.3, 6.15 - y, i === 0 ? C.text2 : C.background2);
      txt(s, "関門" + n, { x: x + 0.15, y: y + 0.1, w: 2.0, h: 0.4, fontSize: 15, bold: true, color: i === 0 ? C.accent3 : C.accent2 });
      txt(s, h, { x: x + 0.15, y: y + 0.5, w: 2.05, h: 0.75, fontSize: 18, bold: true, color: i === 0 ? C.background1 : C.text2 });
      txt(s, d, { x: x + 0.15, y: y + 1.25, w: 2.05, h: 1.3, fontSize: 14, color: i === 0 ? C.background1 : C.text1 });
      tag(s, st === "達成" ? "達成" : "未達", x + 0.15, 5.65, 1.0, k);
    });
    txt(s, "今ここ", { x: 0.6, y: 3.12, w: 2.3, h: 0.4, fontSize: 17, bold: true, color: C.accent2, align: "center" });
    frame(s, 0.6, 6.3, 12.13, 0.68, C.accent6);
    txt(s, [{ text: "即No-Go　", options: { bold: true, color: C.accent6 } }, { text: "補助者の欠員・緊急連絡が不通・床や台の危険・同意や保存先が未設定など。売上目標や予約人数を理由に例外にしない" }], { x: 0.85, y: 6.3, w: 11.7, h: 0.68, fontSize: 15, valign: "middle" });
    note(s, `
開始までの関門です。品質管理とGo/No-Go判定票の案では、関門0から4の段階を決めていて、条件を満たした段階だけ先へ進みます。
関門0は文書の準備で、手順・記録票・判定票の案がそろうこと。ここは達成しました。
関門1は模擬測定です。職員などの協力者で通し練習をするために、施設、救急、役割の承認が必要です。
関門2は従業員でのパイロットです。監査の10の必須条件と、安全・情報・データの試験に合格することが条件です。
関門3は企業への報告で、照合、開示審査、表現の確認が終わるまでは、データを集めていても報告しません。
関門4は拡大で、パイロットの安全・時間・原価の実績で判断します。事故がなかった、SPQが良くなった、というだけで拡大は決めません。
また、補助者の欠員、緊急連絡が通じない、床や台が危ない、同意や保存先が未設定といった場合は、その場で即No-Goです。売上目標や予約人数を理由に例外にはしません。`);
  }

  {
    const s = content(7, "これから90日間の計画（監査の提案日程）");
    const X0 = 3.95, X1 = 12.73, DAYS = 90, dx = (X1 - X0) / DAYS;
    const dayX = (d) => X0 + (d - 1) * dx;
    [["11月", 1, 22], ["12月", 23, 53], ["1月", 54, 84], ["2月", 85, 90]].forEach(([m, a, b]) => {
      s.addShape(pres.shapes.RECTANGLE, { x: dayX(a), y: 1.6, w: (b - a + 1) * dx, h: 0.45, fill: { color: C.text2 }, line: { color: HEX.lt1, width: 1 }, objectName: "month" });
      txt(s, m, { x: dayX(a), y: 1.6, w: (b - a + 1) * dx, h: 0.45, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    const rows = [
      ["① 準備", "責任者任命・価格統一・照会", 1, 14, "11/9–11/22"],
      ["② 顧客面談", "8〜10法人・1業種に集中", 8, 45, "11/16–12/23"],
      ["③ 模擬測定", "職員等で通し練習・規程整備", 15, 35, "11/23–12/13"],
      ["④ 開始条件の確認", "10条件を会議で照合", 36, 50, "12/14–12/28"],
      ["⑤ 有料パイロット", "1法人・40人以下で初回測定", 51, 75, "12/29–1/22"],
      ["⑥ 中間判定", "続行・改修・中止を判断", 76, 90, "1/23–2/6"],
    ];
    const RH = 0.68;
    rows.forEach(([h, d, a, b, dates], i) => {
      const y = 2.15 + i * RH;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y, w: X1 - 0.6, h: RH, fill: { color: i % 2 ? C.background1 : C.background2 }, line: { type: "none" }, objectName: "row" });
      txt(s, h, { x: 0.7, y: y + 0.03, w: 3.2, h: 0.36, fontSize: 18, bold: true, color: C.text2 });
      txt(s, d, { x: 0.7, y: y + 0.38, w: 3.2, h: 0.28, fontSize: 13, color: GRAY });
      const col = i === 3 ? C.accent4 : i === 4 ? C.accent2 : C.text2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: dayX(a), y: y + 0.12, w: (b - a + 1) * dx, h: RH - 0.24, fill: { color: col }, line: { type: "none" }, rectRadius: 0.08, objectName: "bar " + h });
      txt(s, dates, { x: dayX(a), y: y + 0.12, w: (b - a + 1) * dx, h: RH - 0.24, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    const gx = dayX(51);
    s.addShape(pres.shapes.LINE, { x: gx, y: 2.1, w: 0, h: RH * 6 + 0.1, line: { color: HEX.accent6, width: 2, dashType: "dash" } });
    txt(s, "関門：④を満たさなければ⑤は延期", { x: gx - 4.75, y: 2.15 + 5 * RH + 0.12, w: 4.65, h: RH - 0.24, fontSize: 15, bold: true, color: C.accent6, align: "right" });
    txt(s, [{ text: "Day1＝2026年11月9日とした監査の提案日程。担当者は未定。", options: { breakLine: true } }, { text: "年末年始と重なるため実際の日程は要調整。効果を見る再測定は約3か月後（Day140前後）。" }], { x: 0.6, y: 6.3, w: 12.13, h: 0.7, fontSize: 14, color: GRAY });
    note(s, `
これから90日間の計画案です。監査報告書が示した日程で、Day1を2026年11月9日としています。担当者はまだ決まっていません。
①準備では、責任者を任命し、価格などの版を一本化し、勤務表で兼務できる時間を確認し、盛岡市への照会と保険の見積を行います。②顧客面談は、1つの業種に絞って8〜10法人の決裁者と面談し、見積を3件出すことを目指します。③模擬測定では、職員や知人などで通し練習をし、1人あたりの時間や全員が満点になる項目がないかを確認します。同意書や契約書の雛形も整えます。
④開始条件の確認では、監査の10条件の証拠を会議で照合します。赤い点線が関門で、ここを満たさなければ⑤の有料パイロットは延期します。⑤は1法人・40人以下で初回測定を行い、⑥の中間判定で、続けるか、直すか、やめるかを判断します。効果を見る再測定は約3か月後です。
この日程は年末年始と重なるため、実際にはずれる可能性が高いです。日程よりも条件を満たすことを優先します。`);
  }

  {
    const s = content(7, "将来の展望：産業保健部門の中でのWPC");
    const flow = [["産業保健セミナー", "法人との接点"], ["WPC（測定）", "課題の見える化"], ["Office Training", "職場訪問の継続支援"]];
    flow.forEach(([h, d], i) => {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.6, 3.6, 1.35, i === 1 ? C.accent2 : C.text2);
      txt(s, [{ text: h, options: { bold: true, fontSize: 20, breakLine: true } }, { text: d, options: { fontSize: 15 } }], { x, y: 1.6, w: 3.6, h: 1.35, color: C.background1, align: "center", valign: "middle" });
      if (i < 2) arrowR(s, x + 3.66, 2.05, 0.4, 0.45);
    });
    txt(s, "Office Training は結果の振り返り後に任意で別提案。WPCの購入条件にはしない", { x: 0.6, y: 3.02, w: 12.13, h: 0.38, fontSize: 15, color: GRAY });
    const steps = [["1", "パイロットで確かめる", "安全・時間・原価・支払意思"], ["2", "サービスを改善する", "価格・項目・体制を実測で見直す"], ["3", "同じ企業の別拠点へ", "本部一括契約で広げる"], ["4", "部門全体の展開", "東北での展開・大学との共同研究（2028年目標）など"]];
    steps.forEach(([n, h, d], i) => {
      const x = 0.6 + i * 3.08;
      card(s, x, 3.6, 2.9, 2.0, i === 0 ? C.text2 : C.background2);
      txt(s, n, { x: x + 0.18, y: 3.68, w: 0.6, h: 0.55, fontSize: 26, bold: true, color: i === 0 ? C.background1 : C.accent2 });
      txt(s, h, { x: x + 0.18, y: 4.22, w: 2.6, h: 0.45, fontSize: 17, bold: true, color: i === 0 ? C.background1 : C.text2 });
      txt(s, d, { x: x + 0.18, y: 4.7, w: 2.6, h: 0.85, fontSize: 14, color: i === 0 ? C.background1 : C.text1 });
    });
    caution(s, "未確定", "2〜4はすべて構想・目標です。東北6県でのOffice Training 50社や、大学との共同研究は時期・人員・投資・合意が決まっていません", 5.8, 0.95, { fs: 15 });
    note(s, `
将来の展望です。WPCは、当社の産業保健部門の構想の中に位置づけられています。産業保健セミナーで法人との接点をつくり、WPCの測定で課題を見える化し、職場訪問で継続支援を行うOffice Trainingにつなげる、という流れです。ただしOffice Trainingは、WPCの結果を振り返った後に任意で別提案するもので、WPCの購入条件にはしません。監査は、WPCをOffice Trainingの入口となる導入診断として位置づけ、企業単位で採算を考える案も示しています。
進め方は階段のようにします。今は1段目、パイロットで確かめる段階です。2段目で実測をもとにサービスを改善し、3段目で同じ企業の別拠点へ広げ、4段目で部門全体の展開へ進みます。
2段目以降はすべて構想・目標です。東北6県でOffice Training 50社という目標や、2028年の大学との共同研究開始も、時期・人員・投資・相手方との合意が決まっていません。確定した計画として社外で話さないようにお願いします。`);
  }

  {
    const s = content(7, "社員の皆さんに伝えたいこと");
    const blocks = [
      [md.MdLightbulb, "実現したい価値", "accent2", ["働く人に自分の体を知ってもらう", "安全に長く働ける職場を、PTの専門性で支える"]],
      [md.MdHandshake, "お願いしたいこと", "text2", ["デイの利用者と基準を最優先", "模擬測定・勤務表確認に協力", "気づいたリスクは早めに報告", "社外で「効果がある」「契約済み」と言わない"]],
      [md.MdFlag, "今の課題", "accent4", ["価格と仕様の一本化", "兼務と人員基準の確認", "安全手順の承認", "個人情報の扱いの確定"]],
    ];
    for (const [i, [ic, h, k, items]] of blocks.entries()) {
      const x = 0.6 + i * 4.12;
      card(s, x, 1.62, 3.88, 4.7);
      await iconCircle(s, ic, x + 0.25, 1.82, 0.8, C[k]);
      txt(s, h, { x: x + 1.2, y: 1.82, w: 2.6, h: 0.8, fontSize: 21, bold: true, color: C.text2, valign: "middle" });
      txt(s, bullets(items), { x: x + 0.2, y: 2.82, w: 3.6, h: 3.4, paraSpaceAfter: 10 });
    }
    txt(s, "急がず、確かめながら進めます。疑問や心配は遠慮なく聞いてください。", { x: 0.6, y: 6.45, w: 12.13, h: 0.45, fontSize: 18, bold: true, color: C.text2, align: "center" });
    note(s, `
最後に、皆さんに伝えたいことです。
WPCで実現したいのは、働く人が自分の体の状態を知り、安全に長く働ける職場づくりを、理学療法士の専門性で支えることです。デイサービスで培ってきた力を、地域の企業で働く人にも届けたいと考えています。
お願いは4つです。デイサービスの利用者さんと人員基準を最優先にすること。模擬測定や勤務表の確認に協力すること。安全や個人情報で気になることは早めに報告すること。社外で「効果がある」「契約が決まっている」と言わないこと。
今の課題は、価格と仕様の一本化、兼務と人員基準の確認、安全手順の承認、個人情報の扱いの確定です。
急がず、確かめながら進めます。疑問や心配は遠慮なく聞いてください。`);
  }

  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: L.curSection });
    s.addText("質疑応答", { placeholder: "title" });
    s.addText("ご質問・ご意見をお聞かせください", { placeholder: "body" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 5.0, w: 11.7, h: 1.6, fill: { color: C.background1, transparency: 88 }, line: { color: C.accent3, width: 1 }, rectRadius: 0.12, objectName: "faq" });
    txt(s, [
      { text: "よくある質問", options: { bold: true, breakLine: true } },
      { text: "「いつ始まる？」→ 開始条件を満たしてから。日付は未定", options: { breakLine: true } },
      { text: "「誰が担当する？」→ 未定。デイサービスの勤務への影響を確認して相談します" },
    ], { x: 1.1, y: 5.05, w: 11.1, h: 1.5, fontSize: 17, color: C.background1, valign: "middle" });
    note(s, `
ご清聴ありがとうございました。質疑応答の時間です。想定される質問に先にお答えします。
「いつから始まるのか」――監査が示した開始条件を満たしてからです。日付はまだ決まっていません。
「誰が担当するのか」――まだ決まっていません。デイサービスの勤務への影響を確認したうえで、個別にご相談します。
「デイサービスの仕事は増えるのか」――人員基準を守ることが前提です。兼務できる時間を勤務表で確認し、無理のない範囲で計画します。
「本当に効果があるのか」――まだ分かりません。パイロットでは、まず安全に実施できるか、時間や費用、企業の支払意思を確かめます。
この場で答えられないことは、確認して後日お答えします。巻末に用語集と根拠資料の一覧を付けています。`);
  }

  // ===== 付録 =====
  section("付録");
  {
    const s = content("付録", "付録1　用語集");
    const terms = [
      ["産業保健", "働く人の健康と安全を職場で守る取り組み"], ["理学療法士（PT）", "体の動きの専門職（国家資格）"],
      ["プレゼンティーイズム", "出勤していても健康上の問題で力を発揮できない状態"], ["KPI", "事業が順調かを確かめるための指標"],
      ["SPQ", "健康上の理由による仕事への影響を本人が答える1問の質問"], ["WAS", "働く力を0〜10点で自己評価する質問（未導入）"],
      ["ポイント（pp）", "割合どうしの差。20%と15%の差は5ポイント"], ["有料パイロット", "本格販売前に1社で小規模に有料で試すこと"],
      ["限界利益", "売上から提供に伴って増える費用を引いた利益"], ["増分キャッシュフロー", "事業を始めることで会社の現金が増える額"],
      ["管理会計上の損益", "職員の時間も費用に含めた、事業そのものの損益"], ["人員基準・加算", "介護保険の配置の決まりと、要件で上乗せされる報酬"],
      ["指定権者", "介護事業所を指定・指導する行政（盛岡市）"], ["要配慮個人情報", "病歴など特に配慮が必要な情報。取得は原則本人同意"],
    ];
    terms.forEach(([t, d], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 1.6 + row * 0.75;
      card(s, x, y, 5.96, 0.66, row % 2 ? C.background1 : C.background2);
      txt(s, t, { x: x + 0.15, y, w: 2.25, h: 0.66, fontSize: 15, bold: true, color: C.text2, valign: "middle" });
      txt(s, d, { x: x + 2.4, y, w: 3.48, h: 0.66, fontSize: 13, valign: "middle" });
    });
    note(s, `資料の中で使った専門用語の一覧です。説明会の後で見返すときに使ってください。`);
  }

  {
    const s = content("付録", "付録2　根拠資料と、その状態");
    const rows = [
      ["資料", "版・日付", "状態", "この資料での使い方"],
      ["WPC統合事業計画書", "第4版（11/2、11/4改訂）", "正本", "事業内容の最優先の根拠"],
      ["独立第三者監査報告書", "2026/11/4", "監査意見", "課題・開始条件・90日計画"],
      ["統合事業計画書（経営判断案）", "Ver.1.0（11/4）", "案", "原価構造・営業KPI"],
      ["追補 増分資金計画", "Ver.1.1（11/4）", "案", "既存資源の方針・資金"],
      ["財務モデル", "Ver.1.1（11/4）", "試算", "3年間・36か月の数値"],
      ["KPI定義書", "Ver.4.0案 D0.1", "承認前", "KPI一覧・数字の読み方・レポート"],
      ["標準測定マニュアル", "Ver.3.1案 D0.1", "承認前", "測定手順・企業レポート6ページ"],
      ["統合最終プロトコル案", "Ver.4.1 D0.1", "承認前", "測定項目の整理・時間・体制・費用"],
      ["現場SOP・記録票／品質管理・判定票", "Ver.4.1 D0.1", "承認前", "安全・記録票・関門"],
      ["パイロット実施仕様と記録様式集", "D0.1", "承認前", "同意の分け方・データ構造"],
    ];
    const tbl = rows.map((r, i) => r.map((c, j) => ({ text: c, options: { bold: i === 0 || j === 0, fontSize: i === 0 ? 14 : 13, color: i === 0 ? C.background1 : j === 2 ? C.accent4 : C.text1, fill: { color: i === 0 ? C.text2 : i % 2 ? C.background2 : C.background1 }, valign: "middle", margin: [2, 8, 2, 8] } })));
    s.addTable(tbl, { x: 0.6, y: 1.6, w: 12.13, colW: [3.9, 2.8, 1.3, 4.13], rowH: 0.43, border: { type: "solid", pt: 1, color: HEX.accent3 } });
    txt(s, "資料間で数字が食い違う場合は、正本を優先しつつ両方を示して「未確定」と表示しました。この資料は承認書ではありません", { x: 0.6, y: 6.45, w: 12.13, h: 0.5, fontSize: 14, color: GRAY });
    note(s, `この資料の根拠とした文書の一覧です。事業内容は第4版の正本を最優先にし、監査報告書の指摘を反映しました。その他の資料の多くは承認前の案です。資料間で数字が違う場合は、両方を示して未確定としています。`);
  }
};
