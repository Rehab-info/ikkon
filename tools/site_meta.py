"""検索・共有向けの head タグ(canonical・OGP)と、フッターの「一献のなかま」を作る共通部品。
build_kura.py・build_columns.py・build_shared.py から使います。
4サービスの住所は data/sites.json だけに書きます(独自ドメインに移すときはそこを直す)。
"""
import json
from html import escape
from pathlib import Path

SITES = json.loads((Path(__file__).resolve().parent.parent / "data/sites.json").read_text(encoding="utf-8"))
URL = {k: v["url"] for k, v in SITES["sites"].items()}
SITE = URL["ikkon"]
TRIPS = SITES["kuratabiTrips"]  # 蔵旅に旅のしおりがある蔵(ID: 名前)
# og:image は、作者・利用条件を確かめられた画像だけを使う(いまは未設定)


def e(s):
    return escape(str(s), quote=True)


def head_meta(title, desc, path, site_name="一献"):
    """path は SITE からの相対パス(トップは "")。"""
    return f'''<link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:site_name" content="{e(site_name)}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
'''


def family(keys, new_tab=False):
    """フッターに置く「一献のなかま」。keys は data/sites.json の sites のキー。"""
    target = ' target="_blank" rel="noopener"' if new_tab else ""
    links = "".join(f'<a href="{e(URL[k])}" data-site="{k}"{target}><b>{e(SITES["sites"][k]["name"])}</b><small>{e(SITES["sites"][k]["desc"])}</small></a>'
                    for k in keys)
    return f'<nav class="family" aria-label="一献のなかま"><span class="family-h">一献のなかま</span>{links}</nav>'


IKKON_FAMILY = ["kuratabi", "sakazuki", "cupzukan"]  # 一献のページのフッターに出すなかま
