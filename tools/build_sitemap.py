"""公開しているページから sitemap.xml を作るスクリプト。
使い方: python3 tools/build_sitemap.py
各ページの <link rel="canonical"> を読み、そのURLだけを載せます(canonical のないページ、noindex のページは載せません)。
kura.html やコラムを作り直したあとに実行してください。GitHub に上げると、公開の仕組みでも自動で実行されます。
"""
import re
from pathlib import Path

from site_meta import SITE

ROOT = Path(__file__).resolve().parent.parent
PAGES = sorted([*ROOT.glob("*.html"), *ROOT.glob("column/*.html"), ROOT / "sakazuki/index.html"])
# Search Console の所有権確認ファイル(google〜.html)はページではないので除く
PAGES = [p for p in PAGES if not re.fullmatch(r"google[0-9a-f]+\.html", p.name)]

urls, errors = [], []
for p in PAGES:
    head = p.read_text(encoding="utf-8").split("</head>")[0]
    if re.search(r'<meta name="robots" content="[^"]*noindex', head):
        continue
    m = re.search(r'<link rel="canonical" href="([^"]+)">', head)
    if not m:
        errors.append(f"{p.relative_to(ROOT)}: canonical がありません")
        continue
    url = m.group(1)
    # canonical が自分自身(公開パス)を指しているか確かめる
    rel = p.relative_to(ROOT).as_posix()
    expected = SITE + (rel[: -len("index.html")] if rel.endswith("index.html") else rel)
    if url != expected:
        errors.append(f"{rel}: canonical が {url} になっています({expected} のはず)")
        continue
    urls.append(url)
if errors:
    raise SystemExit("sitemap.xml を作れません:\n" + "\n".join(errors))

body = "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls)
(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n",
    encoding="utf-8")
print("sitemap.xml", len(urls), "pages")
