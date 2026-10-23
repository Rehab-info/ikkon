(function () {
  'use strict';

  var TEMPS = [
    ['雪冷え', '5℃'], ['花冷え', '10℃'], ['涼冷え', '15℃'], ['常温', '20℃前後'],
    ['ぬる燗', '40℃'], ['上燗', '45℃'], ['熱燗', '50℃']
  ];
  var TYPES = {
    kun:  { label: '薫酒', sub: '香り華やか' },
    sou:  { label: '爽酒', sub: '軽快でなめらか' },
    jun:  { label: '醇酒', sub: 'コクと旨み' },
    juku: { label: '熟酒', sub: '熟成の深み' }
  };
  var TASTE = { all: 'すべて', sweet: '甘口寄り', mid: '中間', dry: '辛口寄り' };
  var TEMPGROUP = { all: 'すべて', cold: '冷やして', room: '常温', kan: '燗で' };
  var PRICE = { low: '手頃 〜2,000円', mid: '中 2,000〜4,000円', high: '贅沢 4,000円〜' };
  var WORLD = {
    kun: ['白身魚のカルパッチョ', 'フレッシュチーズ', '生春巻き'],
    sou: ['魚介のフリット', 'グリーンサラダ', '蒸し鶏の前菜'],
    jun: ['鶏のクリーム煮', 'ハードチーズ', '餃子'],
    juku: ['ブルーチーズ', '麻婆豆腐', 'ビターチョコレート']
  };
  var PRICE_SHORT = { low: '手頃', mid: '中価格', high: '贅沢' };
  var BUY = { wide: 'スーパーでも', shop: '酒販店・通販', tokuyaku: '特約店のみ' };

  var sakes = [];
  var state = { q: '', type: [], taste: 'all', temp: 'all', price: [], buy: [], region: 'all' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // カタカナ→ひらがな、全角英数→半角、英字は小文字にそろえて比べる
  function norm(s) {
    s = String(s);
    if (s.normalize) s = s.normalize('NFKC');
    return s.toLowerCase().replace(/[\u30a1-\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }

  function tasteOf(s) { return s.sweet <= -0.5 ? 'sweet' : (s.sweet >= 0.5 ? 'dry' : 'mid'); }
  function tempGroups(s) {
    var g = {};
    s.temps.forEach(function (t) {
      if (t === '常温') g.room = 1; else if (/燗/.test(t)) g.kan = 1; else g.cold = 1;
    });
    return g;
  }

  function matches(s) {
    if (state.q) {
      var hay = norm([s.name, s.kana, s.brewery, s.pref, s.region, s.spec, s.note, s.oneliner || '', s.rice || ''].concat(s.pairing).join(' '));
      if (hay.indexOf(state.q) === -1) return false;
    }
    if (state.type.length && state.type.indexOf(s.type) === -1) return false;
    if (state.taste !== 'all' && tasteOf(s) !== state.taste) return false;
    if (state.temp !== 'all' && !tempGroups(s)[state.temp]) return false;
    if (state.price.length && state.price.indexOf(s.price) === -1) return false;
    if (state.buy.length && state.buy.indexOf(s.buy) === -1) return false;
    if (state.region === 'pref:宮城') { if (s.pref !== '宮城') return false; }
    else if (state.region !== 'all' && s.region !== state.region) return false;
    return true;
  }

  /* ---------- filters UI ---------- */
  function chipGroup(el, opts, key, multi, swatch) {
    el.innerHTML = Object.keys(opts).map(function (k) {
      var sw = swatch ? '<span class="sw" style="background:var(--t-' + k + ')"></span>' : '';
      var label = typeof opts[k] === 'string' ? opts[k] : opts[k].label;
      return '<button type="button" class="chip" data-k="' + k + '" aria-pressed="false">' + sw + esc(label) + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var k = b.getAttribute('data-k');
      if (multi) {
        var i = state[key].indexOf(k);
        if (i === -1) state[key].push(k); else state[key].splice(i, 1);
      } else state[key] = k;
      update();
    });
  }
  function syncChips(el, key, multi) {
    Array.prototype.forEach.call(el.querySelectorAll('.chip'), function (b) {
      var k = b.getAttribute('data-k');
      b.setAttribute('aria-pressed', String(multi ? state[key].indexOf(k) !== -1 : state[key] === k));
    });
  }

  /* ---------- cards ---------- */
  function scale(left, right, v) {
    var pct = ((v + 2) / 4) * 100;
    return '<div class="scale"><span>' + left + '</span><div class="bar"><i style="left:' + pct.toFixed(1) + '%"></i></div><span>' + right + '</span></div>';
  }
  /* ---------- bottle illustration / photo ---------- */
  var GLASS = { kun: '#9cbfd2', sou: '#3f7a52', jun: '#6e4524', juku: '#3d2517' };
  function bottle(s) {
    var brand = s.name.split(' ')[0].replace(/[ 　]/g, '');
    var chars = Array.from ? Array.from(brand) : brand.split('');
    var fs = Math.min(13, Math.floor(52 / chars.length));
    var y0 = 106 - (chars.length * fs) / 2 + fs * 0.85;
    var txt = chars.map(function (c, i) {
      return '<text x="30" y="' + (y0 + i * fs).toFixed(1) + '" font-size="' + fs + '" text-anchor="middle">' + esc(c) + '</text>';
    }).join('');
    return '<svg class="bottle" viewBox="0 0 60 164" aria-hidden="true">' +
      '<path d="M24 12h12v26c0 10 16 14 16 30v84q0 6-6 6H14q-6 0-6-6V68c0-16 16-20 16-30z" fill="' + GLASS[s.type] + '"/>' +
      '<path d="M13 72v74" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="22" y="3" width="16" height="13" rx="2" fill="var(--ai)"/>' +
      '<rect x="14" y="76" width="32" height="60" rx="2" fill="#fbf6ea" stroke="#2a1d14" stroke-opacity=".15"/>' +
      '<rect x="14" y="76" width="32" height="5" fill="var(--t-' + s.type + ')"/>' +
      '<g fill="#2a1d14" font-family="Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, serif" font-weight="700">' + txt + '</g>' +
      '</svg>';
  }
  function media(s, cls) {
    var ill = bottle(s);
    if (!s.photo) return '<div class="' + cls + '">' + ill + '</div>';
    return '<div class="' + cls + ' has-photo"><img src="' + esc(s.photo) + '" alt="' + esc(s.name) + 'の写真" loading="lazy" ' +
      'onerror="this.parentNode.classList.remove(\'has-photo\');this.remove()">' + ill + '</div>';
  }

  function card(s) {
    var t = TYPES[s.type];
    return '<button type="button" class="card" data-id="' + s.id + '">' +
      media(s, 'card-media') +
      '<div class="card-body">' +
      '<div class="card-top"><div><div class="kana">' + esc(s.kana) + '</div><h3>' + esc(s.name) + '</h3></div>' +
      '<span class="type-pill t-' + s.type + '">' + t.label + '</span></div>' +
      '<p class="one">' + esc(s.oneliner || '') + '</p>' +
      '<div class="meta">' + esc(s.spec) + ' ・ ' + esc(s.brewery) + '(' + esc(s.pref) + ')</div>' +
      scale('甘口', '辛口', s.sweet) + scale('淡麗', '濃醇', s.body) +
      '<div class="tags"><span class="tag">おすすめ ' + esc(s.best) + '</span>' +
      '<span class="tag plain">' + PRICE_SHORT[s.price] + '</span></div>' +
      '</div></button>';
  }

  /* ---------- taste map ---------- */
  var W = 640, H = 380, M = { l: 56, r: 24, t: 28, b: 44 }, R = 7;
  function sizeMap() {
    var box = $('map-box');
    var w = Math.round(Math.min(640, Math.max(300, (box.clientWidth || 640) - 16)));
    W = w;
    if (w < 520) { H = Math.round(w * 1.15); M = { l: 12, r: 12, t: 30, b: 46 }; R = 6; }
    else { H = 460; M = { l: 56, r: 24, t: 28, b: 44 }; R = 7; }
    $('map').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  function px(s) { return M.l + ((s.sweet + 2) / 4) * (W - M.l - M.r); }
  function py(s) { return M.t + (1 - (s.body + 2) / 4) * (H - M.t - M.b); }

  function drawMap() {
    sizeMap();
    var cx = px({ sweet: 0 }), cy = py({ body: 0 });
    var out = [];
    out.push('<line class="axis" x1="' + M.l + '" y1="' + cy + '" x2="' + (W - M.r) + '" y2="' + cy + '"/>');
    out.push('<line class="axis" x1="' + cx + '" y1="' + M.t + '" x2="' + cx + '" y2="' + (H - M.b) + '"/>');
    out.push('<text class="axis-label" x="' + M.l + '" y="' + (H - 16) + '">← 甘口</text>');
    out.push('<text class="axis-label" x="' + (W - M.r) + '" y="' + (H - 16) + '" text-anchor="end">辛口 →</text>');
    out.push('<text class="axis-label" x="' + (cx + 8) + '" y="' + (M.t - 10) + '">濃醇 ↑</text>');
    out.push('<text class="axis-label" x="' + (cx + 8) + '" y="' + (H - M.b + 30) + '">淡麗 ↓</text>');
    out.push('<text class="quad" x="' + (M.l + 6) + '" y="' + (M.t + 14) + '">濃醇甘口</text>');
    out.push('<text class="quad" x="' + (W - M.r - 6) + '" y="' + (M.t + 14) + '" text-anchor="end">濃醇辛口</text>');
    out.push('<text class="quad" x="' + (M.l + 6) + '" y="' + (H - M.b - 8) + '">淡麗甘口</text>');
    out.push('<text class="quad" x="' + (W - M.r - 6) + '" y="' + (H - M.b - 8) + '" text-anchor="end">淡麗辛口</text>');

    // place labels with simple collision avoidance
    var placed = [];
    var pts = sakes.map(function (s) { return { s: s, x: px(s), y: py(s) }; });
    pts.forEach(function (p) { placed.push({ x: p.x - 8, y: p.y - 8, w: 16, h: 16 }); });
    // 四隅の「濃醇甘口」などの文字とも重ねない
    placed.push({ x: M.l, y: M.t, w: 56, h: 18 }, { x: W - M.r - 56, y: M.t, w: 56, h: 18 }, { x: M.l, y: H - M.b - 22, w: 56, h: 18 }, { x: W - M.r - 56, y: H - M.b - 22, w: 56, h: 18 });
    pts.forEach(function (p) {
      var label = p.s.name.split(' ')[0];
      var w = label.length * 12.5 + 2, h = 15, o = R + 4;
      var cands = [
        [p.x + o, p.y + 4, 'start'], [p.x - o, p.y + 4, 'end'],
        [p.x, p.y - o - 1, 'middle'], [p.x, p.y + o + 9, 'middle'],
        [p.x + o, p.y - 9, 'start'], [p.x + o, p.y + 17, 'start'],
        [p.x - o, p.y - 9, 'end'], [p.x - o, p.y + 17, 'end']
      ];
      var pick = null, box;
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        var bx = c[2] === 'start' ? c[0] : (c[2] === 'end' ? c[0] - w : c[0] - w / 2);
        box = { x: bx, y: c[1] - 11, w: w, h: h };
        var inside = bx >= 2 && bx + w <= W - 2 && box.y >= 2 && box.y + h <= H - 2;
        var hit = placed.some(function (q) { return box.x < q.x + q.w && box.x + box.w > q.x && box.y < q.y + q.h && box.y + box.h > q.y; });
        if (inside && !hit) { pick = c; break; }
      }
      if (!pick) { p.label = null; return; }  // 重なるときは名前を出さない(点に触れると名前が出る)
      var fx = pick[2] === 'start' ? pick[0] : (pick[2] === 'end' ? pick[0] - w : pick[0] - w / 2);
      placed.push({ x: fx, y: pick[1] - 11, w: w, h: h });
      p.label = label; p.lx = pick[0]; p.ly = pick[1]; p.anchor = pick[2];
    });
    pts.forEach(function (p) {
      out.push('<circle class="dot-hit" data-id="' + p.s.id + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="13" aria-hidden="true"></circle>');
    });
    pts.forEach(function (p) {
      out.push('<circle class="dot" data-id="' + p.s.id + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + R + '" fill="var(--t-' + p.s.type + ')" tabindex="0" role="button" aria-label="' + esc(p.s.name) + '"><title>' + esc(p.s.name) + '</title></circle>');
      if (p.label) out.push('<text class="dot-label" data-id="' + p.s.id + '" x="' + p.lx.toFixed(1) + '" y="' + p.ly.toFixed(1) + '" text-anchor="' + p.anchor + '" aria-hidden="true">' + esc(p.label) + '</text>');
    });
    $('map').innerHTML = out.join('');
  }

  /* ---------- detail dialog ---------- */
  function openDetail(id) {
    var s = sakes.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var t = TYPES[s.type];
    var temps = TEMPS.map(function (tp) {
      var cls = tp[0] === s.best ? 'best' : (s.temps.indexOf(tp[0]) !== -1 ? 'on' : '');
      return '<div class="' + cls + '"><b>' + tp[1] + '</b>' + tp[0] + '</div>';
    }).join('');
    $('detail').innerHTML =
      '<div class="dlg">' +
      '<div class="dlg-head"><div><div class="kana">' + esc(s.kana) + '</div><h2 id="d-name">' + esc(s.name) + '</h2></div>' +
      '<button type="button" class="close" id="d-close" aria-label="閉じる">×</button></div>' +
      '<div class="dlg-intro">' + media(s, 'dlg-media') + '<div class="intro-text"><p class="one">' + esc(s.oneliner || '') + '</p><p>' + esc(s.note) + '</p></div></div>' +
      '<dl class="spec-table">' +
      '<dt>タイプ</dt><dd><span class="t-' + s.type + '">' + t.label + '</span>(' + t.sub + ')</dd>' +
      '<dt>種類</dt><dd>' + esc(s.spec) + '</dd>' +
      '<dt>蔵元</dt><dd>' + esc(s.brewery) + '(' + esc(s.pref) + ')</dd>' +
      (s.rice ? '<dt>酒米</dt><dd>' + esc(s.rice) + '</dd>' : '') +
      '<dt>価格帯</dt><dd>' + PRICE[s.price] + '(四合瓶の目安)</dd>' +
      '<dt>入手</dt><dd>' + BUY[s.buy] + '</dd></dl>' +
      '<div>' + scale('甘口', '辛口', s.sweet) + scale('淡麗', '濃醇', s.body) + '</div>' +
      '<div><h4>おすすめの温度</h4><div class="temp-scale">' + temps + '</div></div>' +
      '<div><h4>合う料理</h4><ul class="pair">' + s.pairing.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
      '<p class="world"><b>洋食・中華なら</b> ' + WORLD[s.type].map(esc).join('、') + '</p></div>' +
      (s.story ? '<div><h4>蔵の物語</h4><p>' + esc(s.story) + '</p></div>' : '') +
      '<div><h4>買い方</h4><p>' + esc(s.buyNote) + '</p></div>' +
      '<div class="dlg-links">' + (s.url ? '<a class="btn-ghost small inline" href="' + esc(s.url) + '" target="_blank" rel="noopener">蔵元の公式サイト</a>' :
        s.orgUrl ? '<a class="btn-ghost small inline" href="' + esc(s.orgUrl) + '" target="_blank" rel="noopener">蔵元の紹介(宮城県酒造組合)</a>' :
        '<a class="btn-ghost small inline" href="https://www.google.com/search?q=' + encodeURIComponent(s.brewery + ' ' + s.pref + ' 公式') + '" target="_blank" rel="noopener">蔵元を検索する</a>') +
      (s.kura ? '<a class="btn-ghost small inline" href="kura.html#' + esc(s.kura) + '">蔵の情報・見学</a>' : '') +
      (s.pref === '宮城' ? '<a class="btn-ghost small inline" href="miyagi.html">宮城で飲める・買える店</a>' : '') + '</div>' +
      '</div>';
    var dlg = $('detail');
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    $('d-close').addEventListener('click', function () { dlg.close(); });
    try { history.replaceState(null, '', '#' + s.id); } catch (e) {}
  }

  /* ---------- update ---------- */
  function update() {
    syncChips($('f-type'), 'type', true);
    syncChips($('f-taste'), 'taste', false);
    syncChips($('f-temp'), 'temp', false);
    syncChips($('f-price'), 'price', true);
    syncChips($('f-buy'), 'buy', true);
    var hits = sakes.filter(matches);
    var ids = {};
    hits.forEach(function (s) { ids[s.id] = 1; });
    $('count').textContent = hits.length;
    var n = state.type.length + state.price.length + state.buy.length +
      (state.taste !== 'all' ? 1 : 0) + (state.temp !== 'all' ? 1 : 0) + (state.region !== 'all' ? 1 : 0);
    $('fcount').textContent = n; $('fcount').hidden = n === 0;
    $('list').innerHTML = hits.length ? hits.map(card).join('') :
      '<div class="empty">条件に合う銘柄がありません。条件を減らしてみてください。</div>';
    Array.prototype.forEach.call($('map').querySelectorAll('[data-id]'), function (n) {
      var off = !ids[n.getAttribute('data-id')];
      n.classList.toggle('off', off);
      if (n.classList.contains('dot')) n.setAttribute('tabindex', off ? '-1' : '0');
    });
  }

  /* ---------- はじめての一杯 ---------- */
  var QUIZ = {
    aroma: { label: { rich: '華やか', calm: '控えめ' } },
    body: { label: { light: 'すっきり軽く', full: 'しっかり旨み' } },
    temp: { label: { cold: '冷やして', warm: '常温・燗で' } }
  };
  var answer = { aroma: 'rich', body: 'light', temp: 'cold' };  // 初めての人に好まれやすいフルーティー・フレッシュ寄り
  function quizScore(s) {
    var sc = 0, g = tempGroups(s);
    if (answer.aroma === 'rich') sc += { kun: 3, sou: 1, jun: 0, juku: 0 }[s.type];
    else sc += { kun: -1, sou: 2, jun: 3, juku: 2 }[s.type];
    sc += (answer.body === 'light' ? -s.body : s.body) * 1.5;
    var coldBest = /冷え/.test(s.best);
    if (answer.temp === 'cold') sc += (g.cold ? 1.5 : -2) + (coldBest ? 1 : 0);
    else sc += ((g.kan || g.room) ? 1.5 : -2) + (!coldBest ? 1 : 0);
    sc += { wide: 0.8, shop: 0.4, tokuyaku: -0.6 }[s.buy];  // 手に入りやすさ
    return sc;
  }
  function renderQuiz() {
    ['aroma', 'body', 'temp'].forEach(function (k) {
      Array.prototype.forEach.call($('q-' + k).querySelectorAll('.chip'), function (b) {
        b.setAttribute('aria-pressed', String(answer[k] === b.getAttribute('data-k')));
      });
    });
    var ranked = sakes.slice().sort(function (a, b) { return quizScore(b) - quizScore(a); });
    var top = ranked[0], alt = ranked.slice(1, 3);
    var t = TYPES[top.type];
    $('quiz-result').innerHTML =
      '<div class="pick">' + media(top, 'pick-media') +
      '<div class="pick-body"><div class="eyebrow">今夜のおすすめ</div>' +
      '<h3>' + esc(top.name) + '</h3>' +
      '<p class="one">' + esc(top.oneliner || '') + '</p>' +
      '<div class="tags"><span class="type-pill t-' + top.type + '">' + t.label + '</span>' +
      '<span class="tag">おすすめ ' + esc(top.best) + '</span><span class="tag plain">' + PRICE_SHORT[top.price] + '</span>' +
      '<span class="tag plain">' + BUY[top.buy] + '</span></div>' +
      '<button type="button" class="btn" data-open="' + top.id + '">詳しく見る</button></div></div>' +
      '<div class="alts"><span>ほかの候補</span>' + alt.map(function (a) {
        return '<button type="button" class="btn-ghost small" data-open="' + a.id + '">' + esc(a.name.split(' ')[0]) + '</button>';
      }).join('') + '</div>';
  }
  function initQuiz() {
    ['aroma', 'body', 'temp'].forEach(function (k) {
      var lab = QUIZ[k].label;
      $('q-' + k).innerHTML = Object.keys(lab).map(function (v) {
        return '<button type="button" class="chip" data-k="' + v + '" aria-pressed="false">' + lab[v] + '</button>';
      }).join('');
      $('q-' + k).addEventListener('click', function (e) {
        var b = e.target.closest('.chip'); if (!b) return;
        answer[k] = b.getAttribute('data-k'); renderQuiz();
      });
    });
    $('quiz-result').addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]'); if (b) openDetail(b.getAttribute('data-open'));
    });
    renderQuiz();
  }

  /* ---------- 月の視差(スクロールで少しだけ遅れて動く) ---------- */
  function initParallax() {
    var moon = $('hc-moon');
    if (!moon || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var ticking = false;
    function apply() {
      var y = Math.min(window.scrollY || 0, 700);
      moon.style.transform = 'translateY(' + (y * 0.18).toFixed(1) + 'px)';
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
    apply();
  }

  function init(data) {
    sakes = data;
    $('total').textContent = sakes.length;
    $('legend').innerHTML = Object.keys(TYPES).map(function (k) {
      return '<span><i style="background:var(--t-' + k + ')"></i>' + TYPES[k].label + '(' + TYPES[k].sub + ')</span>';
    }).join('');
    chipGroup($('f-type'), TYPES, 'type', true, true);
    chipGroup($('f-taste'), TASTE, 'taste', false);
    chipGroup($('f-temp'), TEMPGROUP, 'temp', false);
    chipGroup($('f-price'), PRICE, 'price', true);
    chipGroup($('f-buy'), BUY, 'buy', true);
    var regions = [];
    sakes.forEach(function (s) { if (regions.indexOf(s.region) === -1) regions.push(s.region); });
    var order = ['東北', '関東', '新潟・北陸', '東海', '近畿', '中国・四国', '九州'];
    regions.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    $('f-region').innerHTML = '<option value="all">すべての地域</option>' + regions.map(function (r) {
      return '<option>' + esc(r) + '</option>' + (r === '東北' ? '<option value="pref:宮城">　└ 宮城県</option>' : '');
    }).join('');
    $('f-region').addEventListener('change', function (e) { state.region = e.target.value; update(); });
    $('q').addEventListener('input', function (e) { state.q = norm(e.target.value.trim()); update(); });
    $('filters').addEventListener('submit', function (e) { e.preventDefault(); });
    var panel = $('filter-panel');
    if (window.matchMedia && window.matchMedia('(min-width: 721px)').matches) panel.open = true;
    $('apply').addEventListener('click', function () {
      panel.open = false;
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('open-filters').addEventListener('click', function () {
      panel.open = true;
      $('search').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { var w = W; sizeMap(); if (W !== w) { drawMap(); update(); } }, 150);
    });
    $('reset').addEventListener('click', function () {
      state = { q: '', type: [], taste: 'all', temp: 'all', price: [], buy: [], region: 'all' };
      $('q').value = ''; $('f-region').value = 'all'; update();
    });
    $('list').addEventListener('click', function (e) {
      var c = e.target.closest('.card'); if (c) openDetail(c.getAttribute('data-id'));
    });
    var map = $('map');
    map.addEventListener('click', function (e) {
      var d = e.target.closest('.dot, .dot-hit, .dot-label'); if (d) openDetail(d.getAttribute('data-id'));
    });
    map.addEventListener('keydown', function (e) {
      var d = e.target.closest('.dot, .dot-hit');
      if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(d.getAttribute('data-id')); }
    });
    var dlg = $('detail');
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} });
    drawMap();
    initQuiz();
    initParallax();
    update();
    var h = (location.hash || '').slice(1);
    if (h) openDetail(h);
  }

  fetch('data/sakes.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init, function () {
      $('list').innerHTML = '<div class="empty">銘柄データを読み込めませんでした。ページを再読み込みしてください。</div>';
    })
    .catch(function (e) {
      console.error(e);
      $('list').innerHTML = '<div class="empty">表示中にエラーが起きました。ページを再読み込みしてください。</div>';
    });
})();
