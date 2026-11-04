// Sub-Cut: 画面の処理。記録は localStorage にだけ置く(明細そのものは保存しない)。
(() => {
  const D = window.SubCutDetect, { SERVICES } = window.SubCutServices;
  const KEY = "subcut-v1";
  const $ = s => document.querySelector(s);
  const yen = n => "¥" + Math.round(n).toLocaleString("ja-JP");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CYCLE = { weekly: "毎週", monthly: "毎月", quarterly: "3か月ごと", yearly: "毎年" };
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

  // ---------- 保存 ----------
  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.subs) return s; } catch (e) {}
    return { subs: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("この端末に保存できませんでした"); } }

  // 検知結果を取りこむ。利用者がつけた状態(使っている・解約したなど)は残す
  function merge(detected) {
    let added = 0;
    for (const d of detected) {
      const old = state.subs[d.id];
      if (!old) { added++; state.subs[d.id] = { ...d, status: d.fixed ? "keep" : "active", usage: null }; continue; }
      // 請求の履歴を合わせる
      const seen = new Set(old.charges.map(c => c.date + c.amount));
      const charges = [...old.charges, ...d.charges.filter(c => !seen.has(c.date + c.amount))].sort((a, b) => a.date.localeCompare(b.date));
      const newer = d.lastDate >= old.lastDate;
      state.subs[d.id] = { ...old, ...(newer ? d : {}), charges, count: charges.length, status: old.status, usage: old.usage, cancelledAt: old.cancelledAt, name: old.manual ? old.name : (newer ? d.name : old.name) };
      // 解約したはずなのに解約日より後に請求があれば知らせる
      if (old.status === "cancelled" && old.cancelledAt && d.lastDate > old.cancelledAt) state.subs[d.id].chargedAfterCancel = true;
    }
    return added;
  }

  const list = () => Object.values(state.subs);
  const active = s => s.status !== "cancelled";
  const SVC = id => SERVICES.find(s => s.id === id);
  // 中身が似ていて、ひとつに絞りやすい分類(仕事道具は役割がちがうので重複とみなさない)
  const OVERLAP = ["AI", "動画", "音楽", "読書"];

  // 見直し候補の理由
  function reasons(s) {
    const r = [];
    if (s.status === "cancelled") return r;
    if (s.usage === "never") r.push("使っていない");
    else if (s.usage === "rarely") r.push("あまり使っていない");
    if (s.status === "cancel") r.push("解約予定");
    if (!s.fixed) {
      const same = OVERLAP.includes(s.category) ? list().filter(o => active(o) && o.id !== s.id && o.category === s.category) : [];
      if (same.length) r.push(`${s.category}が${same.length + 1}つ重複`);
    }
    return r;
  }
  const isReview = s => active(s) && s.status !== "keep" && reasons(s).length > 0;

  // ---------- 描画 ----------
  let filter = "active";
  const COLORS = ["#0F766E", "#7C3AED", "#DB2777", "#EA580C", "#2563EB", "#65A30D", "#0891B2", "#9333EA", "#C2410C", "#4F46E5"];
  const colorOf = s => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

  function render() {
    const all = list();
    const act = all.filter(active);
    const monthly = act.reduce((a, s) => a + s.monthly, 0);
    const review = act.filter(isReview);
    const reviewSum = review.reduce((a, s) => a + s.monthly, 0);
    $("#summary").innerHTML = all.length ? `
      <div class="stat"><div class="label">毎月のサブスク・固定費</div><div class="value num">${yen(monthly)}<small>/月</small></div></div>
      <div class="stat"><div class="label">1年にすると</div><div class="value num">${yen(monthly * 12)}</div></div>
      <div class="stat hl"><div class="label">見直し候補 ${review.length}件</div><div class="value num">${yen(reviewSum)}<small>/月</small></div></div>` : "";

    // 気づき
    const ins = [];
    const byCat = {};
    act.filter(s => OVERLAP.includes(s.category)).forEach(s => (byCat[s.category] = byCat[s.category] || []).push(s));
    for (const [cat, ss] of Object.entries(byCat)) if (ss.length >= 2)
      ins.push(`<b>${esc(cat)}</b>のサブスクが${ss.length}つあります(${ss.map(s => esc(s.name)).join("・")}、合計 ${yen(ss.reduce((a, s) => a + s.monthly, 0))}/月)。ひとつに絞れませんか?`);
    const stale = act.filter(s => s.stale);
    if (stale.length) ins.push(`<b>${stale.map(s => esc(s.name)).join("・")}</b> は最近の請求が見当たりません。もう解約済みなら「解約済み」にしておきましょう。`);
    const after = all.filter(s => s.chargedAfterCancel);
    if (after.length) ins.push(`<b>${after.map(s => esc(s.name)).join("・")}</b> は解約したあとにも請求がありました。解約が完了しているか確かめてください。`);
    const unasked = act.filter(s => !s.fixed && !s.usage).length;
    if (unasked) ins.push(`${unasked}件のサブスクに「最近使った?」が未回答です。答えると見直し候補が絞りこめます。`);
    $("#insights").innerHTML = ins.map(t => `<div class="insight">${t}</div>`).join("");

    const shown = all.filter(s => filter === "all" ? true : filter === "active" ? active(s) : filter === "review" ? isReview(s) : s.status === "cancelled")
      .sort((a, b) => (isReview(b) - isReview(a)) || b.monthly - a.monthly);
    $("#subs").innerHTML = shown.map(card).join("") || (all.length ? `<li class="fine">該当するサブスクはありません。</li>` : "");
    $("#empty").hidden = all.length > 0;
    renderSavings();
  }

  function card(s) {
    const svc = SVC(s.serviceId);
    const r = reasons(s);
    const chips = [];
    chips.push(`<span class="chip muted">${esc(s.category)}</span>`);
    if (s.status === "cancelled") chips.push(`<span class="chip ok">${esc(s.cancelledAt || "")} 解約済み・${yen(s.monthly)}/月 削減</span>`);
    else {
      const left = s.nextDate ? days(today(), s.nextDate) : null;
      if (left !== null && left >= 0) chips.push(`<span class="chip${left <= 7 ? " warn" : ""}">次回 ${esc((s.nextDate.slice(0, 4) === today().slice(0, 4) ? s.nextDate.slice(5) : s.nextDate).replace(/-/g, "/"))}${left <= 7 ? `(あと${left}日)` : ""}</span>`);
      r.forEach(x => chips.push(`<span class="chip warn">${esc(x)}</span>`));
      if (s.confidence === "medium" && !s.manual) chips.push(`<span class="chip muted">請求1回のみ・要確認</span>`);
      if (s.stale) chips.push(`<span class="chip muted">最近の請求なし</span>`);
      if (s.status === "keep") chips.push(`<span class="chip ok">残す</span>`);
    }
    const usage = s.status === "cancelled" || s.fixed ? "" : `
      <div class="usage">最近使った?
        ${[["often", "よく使う"], ["rarely", "たまに"], ["never", "使ってない"]].map(([v, l]) => `<button data-act="usage" data-v="${v}" aria-pressed="${s.usage === v}">${l}</button>`).join("")}
      </div>`;
    const actions = s.status === "cancelled"
      ? `<button class="ghost" data-act="undo">解約を取り消す</button><button class="ghost" data-act="remove">一覧から消す</button>`
      : `<button class="primary" data-act="nav">解約ナビ</button>
         <button class="ghost" data-act="keep">${s.status === "keep" ? "残すをやめる" : "残す"}</button>`;
    return `<li class="sub${s.status === "cancelled" ? " cancelled" : ""}" data-id="${esc(s.id)}">
      <div class="sub-head">
        <div class="logo" style="background:${colorOf(s.name)}">${esc([...s.name][0])}</div>
        <div class="sub-name"><b>${esc(s.name)}</b><span>${svc ? "" : esc(s.rawDesc || "")}${s.lastDate ? ` 最終請求 ${esc(s.lastDate)}` : ""}</span></div>
        <div class="sub-price"><b class="num">${yen(s.amount)}</b><span>${CYCLE[s.cycle] || ""}${s.cycle !== "monthly" ? `・月${yen(s.monthly)}` : ""}</span></div>
      </div>
      <div class="chips">${chips.join("")}</div>
      ${usage}
      <div class="actions">${actions}</div>
    </li>`;
  }

  function renderSavings() {
    const done = list().filter(s => s.status === "cancelled");
    const m = done.reduce((a, s) => a + s.monthly, 0);
    // 解約した日から今日までに払わずに済んだ額(周期ごとに数える)
    const so_far = done.reduce((a, s) => {
      if (!s.cancelledAt) return a;
      const step = { weekly: 7, monthly: 30.44, quarterly: 91.3, yearly: 365.25 }[s.cycle] || 30.44;
      return a + Math.floor(Math.max(0, days(s.cancelledAt, today())) / step) * s.amount;
    }, 0);
    $("#savings").innerHTML = `
      <div class="big-save"><div class="label">解約で減らせた額(1年あたり)</div><div class="value num">${yen(m * 12)}</div>
        <div class="label">${done.length}件を解約・毎月 ${yen(m)} の削減</div></div>
      <div class="save-grid">
        <div class="stat"><div class="label">これまでに浮いた額</div><div class="value num">${yen(so_far)}</div></div>
        <div class="stat"><div class="label">見直し候補をすべて解約すると</div><div class="value num">+${yen(list().filter(isReview).reduce((a, s) => a + s.monthly, 0) * 12)}<small>/年</small></div></div>
      </div>
      ${m ? `<p class="fee">「解約おまかせ」を使っていた場合の手数料は ${yen(m)}(削減月額の1か月分)。1年で ${yen(m * 11)} が手元に残ります。</p>` : ""}`;
    const soon = list().filter(s => active(s) && s.nextDate && days(today(), s.nextDate) >= 0 && days(today(), s.nextDate) <= 14)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    $("#upcoming").innerHTML = soon.map(s => `<li><span>${esc(s.name)} <b class="num">${yen(s.amount)}</b></span><span>${esc(s.nextDate)}(あと${days(today(), s.nextDate)}日)</span></li>`).join("")
      || `<li class="fine">14日以内の引き落としはありません。</li>`;
  }

  // ---------- 解約ナビ ----------
  function openNav(s) {
    const svc = SVC(s.serviceId);
    const q = encodeURIComponent(`${s.name} 解約 方法`);
    const steps = svc ? svc.steps : ["サービスにログインする", "「アカウント」「プラン」「お支払い」などの設定を開く", "「解約」「キャンセル」「自動更新を停止」を選ぶ"];
    const left = s.nextDate ? days(today(), s.nextDate) : null;
    $("#nav-body").innerHTML = `
      <h2>${esc(s.name)} の解約</h2>
      <p class="fine">${yen(s.amount)}/${(CYCLE[s.cycle] || "").replace("毎", "")}${left !== null && left >= 0 ? `・次の引き落としまで<b>あと${left}日</b>(それまでに解約すれば次回分はかかりません)` : ""}</p>
      <ol>${steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      ${svc && svc.note ? `<p class="note">${esc(svc.note)}</p>` : ""}
      ${svc ? `<a class="primary open" href="${esc(svc.url)}" target="_blank" rel="noopener noreferrer">${esc(svc.name)} の解約ページを開く ↗</a>`
            : `<a class="primary open" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener noreferrer">解約方法を検索する ↗</a>`}
      <p class="fine">手続きが終わったら、完了メールや画面を確かめてから押してください。</p>
      <div class="done-row">
        <button class="ghost" value="close">あとで</button>
        <button class="primary" value="done" data-id="${esc(s.id)}">解約できた</button>
      </div>
      <p class="fee">解約すると 1年で <b>${yen(s.monthly * 12)}</b> 浮きます。</p>`;
    $("#nav").showModal();
  }
  $("#nav").addEventListener("close", () => {
    if ($("#nav").returnValue !== "done") return;
    const id = $("#nav-body [value=done]").dataset.id;
    const s = state.subs[id]; if (!s) return;
    s.status = "cancelled"; s.cancelledAt = today(); delete s.chargedAfterCancel;
    save(); render(); toast(`${s.name} を解約済みにしました。1年で ${yen(s.monthly * 12)} の削減です`);
  });

  // ---------- 操作 ----------
  $("#subs").addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const id = b.closest(".sub").dataset.id, s = state.subs[id];
    switch (b.dataset.act) {
      case "nav": return openNav(s);
      case "usage": s.usage = s.usage === b.dataset.v ? null : b.dataset.v; break;
      case "keep": s.status = s.status === "keep" ? "active" : "keep"; break;
      case "undo": s.status = "active"; delete s.cancelledAt; break;
      case "remove": if (!confirm(`${s.name} を一覧から消しますか?`)) return; delete state.subs[id]; break;
    }
    save(); render();
  });

  document.querySelectorAll(".filters button").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document.querySelectorAll(".filters button").forEach(x => x.classList.toggle("on", x === b));
    render();
  }));

  function showTab(name) {
    document.querySelectorAll(".tab").forEach(t => (t.hidden = t.id !== "tab-" + name));
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => showTab(b.dataset.goto)));

  // 明細の読みこみ
  function ingest(text, label) {
    const { transactions, subs } = D.analyzeCSV(text);
    if (!transactions.length) { $("#import-status").textContent = `${label}: 明細の行を読み取れませんでした。日付・店名・金額の列がある CSV か確かめてください。`; return; }
    const added = merge(subs); save(); render();
    const msg = `${label}: ${transactions.length}件の利用から、くり返しの引き落としを${subs.length}件見つけました(新規${added}件)。`;
    $("#import-status").textContent = msg; toast(msg);
    if (subs.length) { filter = "active"; document.querySelectorAll(".filters button").forEach(x => x.classList.toggle("on", x.dataset.filter === "active")); showTab("list"); render(); }
  }
  // カード会社の CSV は Shift_JIS のことが多い。UTF-8 で読めなければ Shift_JIS で読み直す
  async function readFile(f) {
    const buf = await f.arrayBuffer();
    const utf = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (!utf.includes("�")) return utf;
    try { return new TextDecoder("shift_jis").decode(buf); } catch (e) { return utf; }
  }
  async function handleFiles(files) {
    for (const f of files) ingest(await readFile(f), f.name);
  }
  $("#file").addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => handleFiles(e.dataTransfer.files));
  $("#paste-go").addEventListener("click", () => ingest($("#paste").value, "貼りつけ"));
  const sample = () => fetch("sample.csv").then(r => r.text()).then(t => ingest(t, "サンプル明細")).catch(() => toast("サンプルを読みこめませんでした"));
  $("#try-sample").addEventListener("click", sample);
  $("#try-sample2").addEventListener("click", sample);

  // 手で追加
  $("#svc-names").innerHTML = SERVICES.map(s => `<option value="${esc(s.name)}">`).join("");
  $("#add-form").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = f.get("name").trim(), amount = +f.get("amount"), cycle = f.get("cycle");
    const svc = SERVICES.find(s => s.name === name) || D.findService(name);
    const id = svc ? "svc:" + svc.id : "manual:" + name;
    if (state.subs[id] && !confirm(`${name} はすでに一覧にあります。上書きしますか?`)) return;
    state.subs[id] = {
      id, name, serviceId: svc ? svc.id : null, category: svc ? svc.cat : "その他", amount, cycle,
      monthly: Math.round(amount * D.PER_MONTH[cycle]), nextDate: f.get("next") || null, lastDate: null,
      charges: [], count: 0, confidence: "high", manual: true, status: "active", usage: null
    };
    save(); e.target.reset(); e.target.closest("details").open = false; render(); toast(`${name} を追加しました`);
  });

  // 更新日をカレンダーへ(各サブスクの次回引き落とし日の前日に通知)
  $("#ics").addEventListener("click", () => {
    const subs = list().filter(s => active(s) && s.nextDate && !s.fixed);
    if (!subs.length) return toast("次回日がわかるサブスクがありません");
    const d = s => s.replace(/-/g, "");
    const rule = { weekly: "WEEKLY", monthly: "MONTHLY", quarterly: "MONTHLY;INTERVAL=3", yearly: "YEARLY" };
    const ev = subs.map(s => [
      "BEGIN:VEVENT", `UID:${encodeURIComponent(s.id)}@subcut`, `DTSTAMP:${d(today())}T000000Z`,
      `DTSTART;VALUE=DATE:${d(s.nextDate)}`, `RRULE:FREQ=${rule[s.cycle] || "MONTHLY"}`,
      `SUMMARY:${s.name} 更新 ${yen(s.amount)}`, "DESCRIPTION:Sub-Cut: 解約するなら今日まで",
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${s.name} は明日更新です`, "END:VALARM", "END:VEVENT"].join("\r\n"));
    download(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sub-Cut//JA", ...ev, "END:VCALENDAR"].join("\r\n"), "subcut-renewals.ics", "text/calendar");
  });

  // データ
  function download(text, name, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("#export").addEventListener("click", () => download(JSON.stringify(state, null, 2), `subcut-${today()}.json`, "application/json"));
  $("#restore").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const s = JSON.parse(await f.text()); if (!s.subs) throw 0; state = s; save(); render(); toast("読みこみました"); }
    catch (err) { toast("Sub-Cut の書き出しファイルではないようです"); }
    e.target.value = "";
  });
  $("#wipe").addEventListener("click", () => { if (confirm("すべての記録を消します。よろしいですか?")) { state = { subs: {} }; save(); render(); } });

  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3200); }

  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
