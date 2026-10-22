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
  var PRICE = { low: '手頃 〜1,500円', mid: '中 1,500〜3,000円', high: '贅沢 3,000円〜' };
  var PRICE_SHORT = { low: '手頃', mid: '中価格', high: '贅沢' };
  var BUY = { wide: 'スーパーでも', shop: '酒販店・通販', tokuyaku: '特約店のみ' };

  var sakes = [];
  var state = { q: '', type: [], taste: 'all', temp: 'all', price: [], buy: [], region: 'all' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

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
      var hay = [s.name, s.kana, s.brewery, s.pref, s.region, s.spec, s.note].concat(s.pairing).join(' ');
      if (hay.indexOf(state.q) === -1) return false;
    }
    if (state.type.length && state.type.indexOf(s.type) === -1) return false;
    if (state.taste !== 'all' && tasteOf(s) !== state.taste) return false;
    if (state.temp !== 'all' && !tempGroups(s)[state.temp]) return false;
    if (state.price.length && state.price.indexOf(s.price) === -1) return false;
    if (state.buy.length && state.buy.indexOf(s.buy) === -1) return false;
    if (state.region !== 'all' && s.region !== state.region) return false;
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
  function card(s) {
    var t = TYPES[s.type];
    return '<button type="button" class="card" data-id="' + s.id + '">' +
      '<div class="card-top"><div><div class="kana">' + esc(s.kana) + '</div><h3>' + esc(s.name) + '</h3></div>' +
      '<span class="type-pill t-' + s.type + '">' + t.label + '</span></div>' +
      '<div class="meta">' + esc(s.spec) + ' ・ ' + esc(s.brewery) + '(' + esc(s.pref) + ')</div>' +
      scale('甘口', '辛口', s.sweet) + scale('淡麗', '濃醇', s.body) +
      '<div class="tags"><span class="tag">おすすめ ' + esc(s.best) + '</span>' +
      '<span class="tag plain">' + PRICE_SHORT[s.price] + '</span>' +
      '<span class="tag plain">' + BUY[s.buy] + '</span></div>' +
      '</button>';
  }

  /* ---------- taste map ---------- */
  var W = 640, H = 380, M = { l: 56, r: 24, t: 28, b: 44 };
  function px(s) { return M.l + ((s.sweet + 2) / 4) * (W - M.l - M.r); }
  function py(s) { return M.t + (1 - (s.body + 2) / 4) * (H - M.t - M.b); }

  function drawMap() {
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
    pts.forEach(function (p) {
      var label = p.s.name.split(' ')[0];
      var w = label.length * 11.5 + 2, h = 14;
      var cands = [
        [p.x + 11, p.y + 4, 'start'], [p.x - 11, p.y + 4, 'end'],
        [p.x, p.y - 12, 'middle'], [p.x, p.y + 20, 'middle'],
        [p.x + 11, p.y - 9, 'start'], [p.x + 11, p.y + 17, 'start'],
        [p.x - 11, p.y - 9, 'end'], [p.x - 11, p.y + 17, 'end']
      ];
      var pick = cands[0], box;
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        var bx = c[2] === 'start' ? c[0] : (c[2] === 'end' ? c[0] - w : c[0] - w / 2);
        box = { x: bx, y: c[1] - 11, w: w, h: h };
        var inside = bx >= 2 && bx + w <= W - 2 && box.y >= 2 && box.y + h <= H - 2;
        var hit = placed.some(function (q) { return box.x < q.x + q.w && box.x + box.w > q.x && box.y < q.y + q.h && box.y + box.h > q.y; });
        if (inside && !hit) { pick = c; break; }
        if (i === cands.length - 1) pick = cands[0];
      }
      var fx = pick[2] === 'start' ? pick[0] : (pick[2] === 'end' ? pick[0] - w : pick[0] - w / 2);
      placed.push({ x: fx, y: pick[1] - 11, w: w, h: h });
      p.label = label; p.lx = pick[0]; p.ly = pick[1]; p.anchor = pick[2];
    });
    pts.forEach(function (p) {
      out.push('<circle class="dot" data-id="' + p.s.id + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7" fill="var(--t-' + p.s.type + ')" tabindex="0" role="button" aria-label="' + esc(p.s.name) + '"><title>' + esc(p.s.name) + '</title></circle>');
      out.push('<text class="dot-label" data-id="' + p.s.id + '" x="' + p.lx.toFixed(1) + '" y="' + p.ly.toFixed(1) + '" text-anchor="' + p.anchor + '">' + esc(p.label) + '</text>');
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
      '<p>' + esc(s.note) + '</p>' +
      '<dl class="spec-table">' +
      '<dt>タイプ</dt><dd><span class="t-' + s.type + '">' + t.label + '</span>(' + t.sub + ')</dd>' +
      '<dt>種類</dt><dd>' + esc(s.spec) + '</dd>' +
      '<dt>蔵元</dt><dd>' + esc(s.brewery) + '(' + esc(s.pref) + ')</dd>' +
      '<dt>価格帯</dt><dd>' + PRICE[s.price] + '(四合瓶の目安)</dd></dl>' +
      '<div>' + scale('甘口', '辛口', s.sweet) + scale('淡麗', '濃醇', s.body) + '</div>' +
      '<div><h4>おすすめの温度</h4><div class="temp-scale">' + temps + '</div></div>' +
      '<div><h4>合う料理</h4><ul class="pair">' + s.pairing.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h4>買い方</h4><p>' + esc(s.buyNote) + '</p></div>' +
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
    $('list').innerHTML = hits.length ? hits.map(card).join('') :
      '<div class="empty">条件に合う銘柄がありません。条件を減らしてみてください。</div>';
    Array.prototype.forEach.call($('map').querySelectorAll('[data-id]'), function (n) {
      n.classList.toggle('off', !ids[n.getAttribute('data-id')]);
    });
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
    var order = ['東北', '新潟・北陸', '東海', '近畿', '中国・四国', '九州'];
    regions.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    $('f-region').innerHTML = '<option value="all">すべての地域</option>' + regions.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
    $('f-region').addEventListener('change', function (e) { state.region = e.target.value; update(); });
    $('q').addEventListener('input', function (e) { state.q = e.target.value.trim(); update(); });
    $('filters').addEventListener('submit', function (e) { e.preventDefault(); });
    $('reset').addEventListener('click', function () {
      state = { q: '', type: [], taste: 'all', temp: 'all', price: [], buy: [], region: 'all' };
      $('q').value = ''; $('f-region').value = 'all'; update();
    });
    $('list').addEventListener('click', function (e) {
      var c = e.target.closest('.card'); if (c) openDetail(c.getAttribute('data-id'));
    });
    var map = $('map');
    map.addEventListener('click', function (e) {
      var d = e.target.closest('.dot'); if (d) openDetail(d.getAttribute('data-id'));
    });
    map.addEventListener('keydown', function (e) {
      var d = e.target.closest('.dot');
      if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(d.getAttribute('data-id')); }
    });
    var dlg = $('detail');
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} });
    drawMap();
    update();
    var h = (location.hash || '').slice(1);
    if (h) openDetail(h);
  }

  fetch('data/sakes.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () {
      $('list').innerHTML = '<div class="empty">銘柄データを読み込めませんでした。ページを再読み込みしてください。</div>';
    });
})();
