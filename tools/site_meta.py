"""検索・共有向けの head タグ(canonical・OGP)を作る共通部品。build_kura.py と build_columns.py から使います。
手で書いているページ(index.html・guide.html・miyagi.html・sakazuki/index.html)にも同じ形で書いてあります。
"""
from html import escape

SITE = "https://rehab-info.github.io/ikkon/"
# og:image は、作者・利用条件を確かめられた画像だけを使う(いまは未設定)


def head_meta(title, desc, path):
    """path は SITE からの相対パス(トップは "")。"""
    e = lambda s: escape(str(s), quote=True)
    return f'''<link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:site_name" content="一献">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
'''
