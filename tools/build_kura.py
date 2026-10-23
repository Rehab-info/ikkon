"""data/kura.json から kura.html(宮城の蔵)を作るスクリプト。
使い方: python3 tools/build_kura.py
蔵の情報を直したら data/kura.json を編集して、このスクリプトを実行してください。
"""
import json
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
kura = json.loads((ROOT / "data/kura.json").read_text(encoding="utf-8"))
sakes = {s["id"]: s for s in json.loads((ROOT / "data/sakes.json").read_text(encoding="utf-8"))}
VERSION = "22"

AREAS = ["仙台・県央", "県南", "塩竈", "大崎・加美・遠田", "栗原・登米", "石巻・気仙沼"]
# 地域の写真(images/ に置いたものだけ表示)
AREA_IMG = {"仙台・県央": ("images/sendai.jpg", "仙台市の町並み"), "塩竈": ("images/matsushima-l.jpg", "塩竈の蔵からほど近い松島湾")}
TOUR = {"yes": ("見学できる", "tour-yes"), "partial": ("一部見学", "tour-ask"), "ask": ("要相談", "tour-ask"), "no": ("見学不可", "tour-no")}
e = html.escape

# 打ち間違いで蔵や銘柄が黙って消えないよう、先に確かめる
errors = []
for k in kura:
    if k["area"] not in AREAS:
        errors.append(f'{k["id"]}: 地域「{k["area"]}」が AREAS にありません')
    if k["tour"] not in TOUR:
        errors.append(f'{k["id"]}: 見学「{k["tour"]}」が TOUR にありません')
    for s in k["sakes"]:
        if s not in sakes:
            errors.append(f'{k["id"]}: 銘柄 ID「{s}」が data/sakes.json にありません')
if errors:
    raise SystemExit("data/kura.json に誤りがあります:\n" + "\n".join(errors))


def card(k):
    label, cls = TOUR[k["tour"]]
    brands = "".join(f"<span>{e(b)}</span>" for b in k["brands"])
    links = []
    if k.get("url"):
        links.append(f'<a href="{e(k["url"])}" target="_blank" rel="noopener">公式サイト</a>')
    links.append(f'<a href="https://miyagisake.jp/kuramoto/{e(k["id"])}/" target="_blank" rel="noopener">宮城県酒造組合の紹介</a>')
    related = ""
    if k["sakes"]:
        items = "、".join(f'<a href="index.html#{e(s)}">{e(sakes[s]["name"])}</a>' for s in k["sakes"])
        related = f'<div class="related">このサイトで紹介:{items}</div>'
    return f'''        <article class="place kura" id="{e(k["id"])}" data-tour="{e(k["tour"])}">
          <div class="place-head"><h3>{e(k["name"])}</h3><span class="area">{e(k["city"])}</span></div>
          <div class="brands">{brands}</div>
          <p>{e(k["intro"])}</p>
          <dl class="info"><dt>創業</dt><dd>{e(k["founded"])}</dd><dt>見学</dt><dd><span class="tour {cls}">{label}</span> {e(k["tourNote"])}</dd></dl>
          {related}
          <div class="links">{"".join(links)}</div>
        </article>'''


def photo(a):
    if a not in AREA_IMG or not (ROOT / AREA_IMG[a][0]).exists():
        return ""
    src, cap = AREA_IMG[a]
    return f'      <figure class="area-photo"><img src="{e(src)}" alt="{e(cap)}" loading="lazy"><figcaption>{e(cap)}</figcaption></figure>\n'


sections = []
for i, a in enumerate(AREAS):
    ks = [k for k in kura if k["area"] == a]
    cards = "\n".join(card(k) for k in ks)
    sections.append(f'''  <section class="section area-sec" id="area{i + 1}">
    <div class="wrap">
      <div class="section-head"><h2>{e(a)}</h2><p>{len(ks)}蔵</p></div>
{photo(a)}      <div class="places">
{cards}
      </div>
    </div>
  </section>''')

jump = "".join(f'<a href="#area{i + 1}">{e(a)}</a>' for i, a in enumerate(AREAS))
n_yes = sum(1 for k in kura if k["tour"] == "yes")

page = f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>一献 宮城の蔵</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="宮城県の酒蔵{len(kura)}蔵と、それぞれの地酒・見学情報。">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;700&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap">
<link rel="stylesheet" href="assets/style.css?v={VERSION}">
</head>
<body>
<header class="site-head">
  <div class="wrap">
    <a class="logo" href="index.html"><span class="mark" aria-hidden="true"></span><b>一献</b><small>日本酒案内</small></a>
    <nav class="nav"><a href="index.html">銘柄</a><a href="guide.html">飲み方</a><a href="kura.html" aria-current="page">宮城の蔵</a><a href="miyagi.html">宮城の店</a></nav>
  </div>
</header>

<main>
  <section class="hero">
    <div class="wrap">
      <div>
        <div class="eyebrow">宮城の地酒 {len(kura)}蔵</div>
        <h1>港町から山あいまで、<br>宮城の蔵をたずねる。</h1>
        <p>宮城県酒造組合に加盟する{len(kura)}の蔵元を、地域ごとに紹介します。それぞれの代表銘柄と、蔵の歩み、見学の受け入れ状況をまとめました。</p>
      </div>
      <div class="janome" aria-hidden="true"><span>宮城</span></div>
    </div>
  </section>

  <section class="section">
    <div class="wrap stack">
      <nav class="jump" aria-label="地域">{jump}</nav>
      <div class="chips"><button type="button" class="chip" id="only-tour" aria-pressed="false">見学できる蔵だけ表示({n_yes}蔵)</button></div>
      <p class="notice">見学の受け入れや時期は変わることがあります。訪問前に必ず各蔵へ問い合わせてください。蔵の情報は<a href="https://miyagisake.jp/kuramoto/" target="_blank" rel="noopener">宮城県酒造組合</a>の蔵元紹介をもとに、2026年10月に確認しました。</p>
    </div>
  </section>

{chr(10).join(sections)}
</main>

<footer class="site-foot">
  <div class="wrap">
    <span>蔵へ車で行くときは、運転する人は試飲できません。</span>
    <span>お酒は20歳になってから。飲酒運転は法律で禁止されています。</span>
  </div>
</footer>
<script>
(function () {{
  var b = document.getElementById('only-tour');
  b.addEventListener('click', function () {{
    var on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    Array.prototype.forEach.call(document.querySelectorAll('.kura'), function (c) {{
      c.hidden = on && c.getAttribute('data-tour') !== 'yes';
    }});
    Array.prototype.forEach.call(document.querySelectorAll('.area-sec'), function (s) {{
      s.hidden = !s.querySelector('.kura:not([hidden])');
    }});
  }});
}})();
</script>
</body>
</html>
'''
(ROOT / "kura.html").write_text(page, encoding="utf-8")
print("kura.html", len(kura))
