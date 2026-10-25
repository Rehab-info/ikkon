"""手で書いているページの共通部分を data/sites.json から書き直すスクリプト。
使い方: python3 tools/build_shared.py
書き直すのは、目印のコメントで囲んだ2か所だけです。
  <!-- shared:meta --> 〜 <!-- /shared:meta -->      head の canonical・OGP(title と description はページのものを使う)
  <!-- shared:family --> 〜 <!-- /shared:family -->  フッターの「一献のなかま」
サイトの住所を変えたら(独自ドメインへの移行など)、data/sites.json を直してこのスクリプトを実行します。
公開の仕組みでも自動で実行されます。
"""
import html
import re
from pathlib import Path

from site_meta import IKKON_FAMILY, family, head_meta

ROOT = Path(__file__).resolve().parent.parent
# (ファイル, 公開パス, og:site_name, フッターに出すなかま, 別のタブで開くか)
PAGES = [
    ("index.html", "", "一献", IKKON_FAMILY, False),
    ("guide.html", "guide.html", "一献", IKKON_FAMILY, False),
    ("miyagi.html", "miyagi.html", "一献", IKKON_FAMILY, False),
    # さかづき帳はホーム画面のアプリとしても使うので、ほかのサイトは別のタブで開いてアプリを残す
    ("sakazuki/index.html", "sakazuki/", "さかづき帳 by 一献", ["ikkon", "cupzukan"], True),
]


def block(text, name, new, path):
    pat = re.compile(rf"(<!-- shared:{name} -->\n?)(.*?)(<!-- /shared:{name} -->)", re.S)
    if len(pat.findall(text)) != 1:
        raise SystemExit(f"{path}: <!-- shared:{name} --> の目印が見つからないか、2つ以上あります")
    return pat.sub(lambda m: m.group(1) + new + m.group(3), text)


changed = 0
for name, path, site_name, keys, new_tab in PAGES:
    p = ROOT / name
    text = p.read_text(encoding="utf-8")
    title = html.unescape(re.search(r"<title>(.*?)</title>", text).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', text).group(1))
    out = block(text, "meta", head_meta(title, desc, path, site_name), name)
    out = block(out, "family", family(keys, new_tab), name)
    if out != text:
        p.write_text(out, encoding="utf-8")
        changed += 1
print("shared:", len(PAGES), "pages", f"({changed} updated)")
