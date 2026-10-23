"""data/columns.json から コラムのページ(column/ 以下)を作るスクリプト。
使い方: python3 tools/build_columns.py            … 公開用(下書き draft: true は載せない)
        python3 tools/build_columns.py --drafts   … 下書きも「下書き」の印付きで載せる(確認用)

コラムを足すときは data/columns.json の entries に1件追加して、このスクリプトを実行してください。
GitHub に上げると、公開の仕組みでも自動で実行されます。
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOW_DRAFTS = "--drafts" in sys.argv
data = json.loads((ROOT / "data/columns.json").read_text(encoding="utf-8"))
sakes = {s["id"]: s for s in json.loads((ROOT / "data/sakes.json").read_text(encoding="utf-8"))}
VERSION = re.search(r"style\.css\?v=(\d+)", (ROOT / "index.html").read_text(encoding="utf-8")).group(1)
e = html.escape
OUT = ROOT / "column"
OUT.mkdir(exist_ok=True)

# 打ち間違いで記事が黙って消えないよう、先に確かめる
errors = []
for s in data["series"]:
    for x in s["entries"]:
        if s["kind"] == "pairing" and x.get("sake") not in sakes:
            errors.append(f'{s["id"]}/{x.get("id")}: 銘柄「{x.get("sake")}」が data/sakes.json にありません')
if errors:
    sys.exit("\n".join(errors))


def nav(current):
    items = [("index", "../index.html", "銘柄"), ("guide", "../guide.html", "飲み方"), ("kura", "../kura.html", "宮城の蔵"),
             ("miyagi", "../miyagi.html", "宮城の店"), ("column", "index.html", "コラム")]
    cur = ' aria-current="page"'
    return "".join(f'<a href="{h}"{cur if k == current else ""}>{l}</a>' for k, h, l in items)


def shell(title, desc, body):
    return f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="{e(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;700&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap">
<link rel="stylesheet" href="../assets/style.css?v={VERSION}">
</head>
<body>
<header class="site-head">
  <div class="wrap">
    <a class="logo" href="../index.html"><span class="mark" aria-hidden="true"></span><b>一献</b><small>日本酒案内</small></a>
    <nav class="nav">{nav("column")}</nav>
  </div>
</header>
<main>
{body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <span>コラムの内容は書き手の感想です。味わいの感じ方には個人差があります。</span>
    <span>お酒は20歳になってから。飲酒運転は法律で禁止されています。</span>
  </div>
</footer>
</body>
</html>
'''


def visible(entries):
    return [x for x in entries if SHOW_DRAFTS or not x.get("draft")]


def draft_mark(x):
    return '<span class="draft-mark">下書き</span>' if x.get("draft") else ""


def pairing_card(x):
    s = sakes[x["sake"]]
    return f'''      <article class="pair-card" id="{e(x["id"])}">
        {draft_mark(x)}
        <div class="pair-head">
          <div class="pair-sake"><small>宮城の酒</small><a href="../index.html#{e(s["id"])}">{e(s["name"])}</a></div>
          <span class="pair-x" aria-hidden="true">×</span>
          <div class="pair-food"><small>宮城のアテ{f"・{e(x['from'])}" if x.get("from") else ""}</small><b>{e(x["food"])}</b></div>
        </div>
        <p>{e(x["text"])}</p>
        <div class="pair-meta">{e(x.get("by", ""))}{" ・ " + e(x["date"]) if x.get("date") else ""}</div>
      </article>'''


def cup_card(x):
    return f'''      <article class="pair-card" id="{e(x["id"])}">
        {draft_mark(x)}
        <div class="pair-head"><div class="pair-food"><small>{e(x.get("brewery", ""))}{"・" + e(x["size"]) if x.get("size") else ""}</small><b>{e(x["name"])}</b></div></div>
        <p>{e(x["text"])}</p>
        <div class="pair-meta">{e(x.get("by", ""))}{" ・ " + e(x["date"]) if x.get("date") else ""}</div>
      </article>'''


def call_box(s):
    url = data.get("submitUrl", "")
    if url:
        action = f'<a class="btn" href="{e(url)}" target="_blank" rel="noopener">投稿する</a>'
    else:
        action = '<p class="call-wait">投稿の受付は準備中です。始まったら、このページでお知らせします。</p>'
    return f'''    <aside class="call">
      <h2>{e(s["callTitle"])}</h2>
      <p>{e(s["callText"])}</p>
      {action}
    </aside>'''


series_cards = []
for s in data["series"]:
    items = visible(s["entries"])
    cards = "\n".join((pairing_card if s["kind"] == "pairing" else cup_card)(x) for x in items)
    if not cards:
        cards = '      <p class="empty">スタッフのおすすめを準備中です。最初の一本をお楽しみに。</p>'
    paras = "".join(f"<p>{e(p)}</p>" for p in s["body"])
    body = f'''  <section class="hero column-hero">
    <div class="wrap">
      <div>
        <div class="eyebrow"><a href="index.html">コラム</a> ・ {e(s["eyebrow"])}</div>
        <h1>{e(s["title"])}</h1>
        <p class="column-lead">{e(s["lead"])}</p>
        <div class="column-body">{paras}</div>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="wrap stack">
      <div class="pair-list">
{cards}
      </div>
{call_box(s)}
    </div>
  </section>'''
    (OUT / f'{s["id"]}.html').write_text(shell(f'一献 {s["title"]}', s["lead"], body), encoding="utf-8")
    n = len(items)
    series_cards.append(f'''      <a class="series-card" href="{e(s["id"])}.html">
        <small>{e(s["eyebrow"])}{f" ・ {n}本" if n else " ・ 準備中"}</small>
        <h2>{e(s["title"])}</h2>
        <p>{e(s["lead"])}</p>
        <span class="series-more">読む</span>
      </a>''')

index_body = f'''  <section class="hero column-hero">
    <div class="wrap">
      <div>
        <div class="eyebrow">コラム</div>
        <h1>一献の、<br>読みもの。</h1>
        <p class="column-lead">スタッフが見つけた宮城の酒の楽しみ方を、連載でお届けします。いずれは、読んでくださる皆さんの声も載せていきます。</p>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <div class="series-list">
{chr(10).join(series_cards)}
      </div>
    </div>
  </section>'''
(OUT / "index.html").write_text(shell("一献 コラム", "宮城の酒の楽しみ方を伝える一献のコラム。", index_body), encoding="utf-8")
print("column/", len(data["series"]), "series", "(drafts shown)" if SHOW_DRAFTS else "")
