"""楽天市場から、各銘柄の商品(写真・価格・販売店・アフィリエイトリンク)を取ってきて data/rakuten.json に書くスクリプト。
公開の仕組み(GitHub Actions)の中で、週1回と GitHub に上げたときに自動で動きます。
手元で試すときは、環境変数 RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定して実行します。

    python3 tools/fetch_rakuten.py

キーがない・楽天が応答しないときも、サイトの公開は止めません(商品欄が出ないだけ)。
結果の概要は rakuten-status.json に書き出すので、公開後に開けば取れたかどうかを確かめられます。
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
AFFILIATE_ID = "58c36830.1e80c147.58c36831.fb6bd4b1"
SITE = "https://rehab-info.github.io/"
PER_SAKE = 3
# 1本の酒を探しているのに、飲み比べやグッズばかり出ないように除く言葉
NG_WORDS = ["飲み比べ", "セット", "福袋", "グラス", "おちょこ", "猪口", "Tシャツ", "酒粕", "粕", "ケース販売", "12本", "6本"]

app_id = os.environ.get("RAKUTEN_APP_ID", "").strip()
access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "").strip()
sakes = json.loads((ROOT / "data/sakes.json").read_text(encoding="utf-8"))
status = {"fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "ok": 0, "empty": [], "errors": []}


def image_of(item):
    """画像の配列は文字列のときと {imageUrl: …} のときがあるので、どちらでも取り出す。少し大きい版にする。"""
    for key in ("mediumImageUrls", "smallImageUrls"):
        for x in item.get(key) or []:
            url = x.get("imageUrl") if isinstance(x, dict) else x
            if url:
                return url.split("?")[0] + "?_ex=300x300"
    return ""


def search(keyword):
    q = {"applicationId": app_id, "accessKey": access_key, "affiliateId": AFFILIATE_ID, "keyword": keyword,
         "hits": 15, "imageFlag": 1, "availability": 1, "formatVersion": 2, "sort": "standard",
         "elements": "itemName,itemPrice,itemUrl,affiliateUrl,mediumImageUrls,smallImageUrls,shopName,reviewAverage,reviewCount"}
    req = urllib.request.Request(ENDPOINT + "?" + urllib.parse.urlencode(q), headers={
        "User-Agent": "ikkon-site/1.0", "Referer": SITE, "Origin": SITE.rstrip("/"), "accessKey": access_key})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)



def fetch_items(s, kw):
    """1つの言葉で探して、条件に合う商品を最大 PER_SAKE 件返す。キーの問題なら None(以降は探さない)。"""
    try:
        data = search(kw)
    except urllib.error.HTTPError as ex:
        body = ex.read().decode("utf-8", "replace")[:200]
        status["errors"].append(f'{s["id"]}「{kw}」: HTTP {ex.code} {body}')
        time.sleep(2)
        return None if ex.code in (401, 403) else []
    except Exception as ex:  # 通信の失敗など
        status["errors"].append(f'{s["id"]}「{kw}」: {ex}')
        time.sleep(2)
        return []
    finally:
        time.sleep(1.1)  # 楽天への負担を減らすため、1秒に1回まで
    items = []
    for it in data.get("Items") or data.get("items") or []:
        it = it.get("Item", it) if isinstance(it, dict) else it
        name = it.get("itemName", "")
        if any(w in name for w in NG_WORDS):
            continue
        img = image_of(it)
        url = it.get("affiliateUrl") or it.get("itemUrl")
        if not img or not url:
            continue
        items.append({"name": name[:80], "price": it.get("itemPrice"), "url": url, "img": img, "shop": it.get("shopName", "")})
        if len(items) >= PER_SAKE:
            break
    return items


out = {}
if not app_id or not access_key:
    status["errors"].append("RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が設定されていません")
else:
    for s in sakes:
        # 1文字の言葉は楽天の検索で受け付けられないので除く。見つからなければ、後ろの言葉を外しながら探し直す
        words = [w for w in (s.get("rakutenQuery") or s["name"]).split() if len(w) >= 2]
        if not words:
            status["empty"].append(s["id"])
            continue
        # 最後に銘柄名1語まで縮めるときは、関係のない商品が出ないよう「日本酒」を足す
        tries = [" ".join(words[:n]) for n in range(len(words), 1, -1)] + [words[0] + " 日本酒"]
        items, stop = [], False
        for kw in tries:
            items = fetch_items(s, kw)
            if items is None:
                stop = True
                break
            if items:
                break
        if stop:
            break
        if items:
            out[s["id"]] = items
            status["ok"] += 1
        else:
            status["empty"].append(s["id"])

(ROOT / "data/rakuten.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
(ROOT / "rakuten-status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")
print(f'楽天市場: {status["ok"]}銘柄で取得、空 {len(status["empty"])}、エラー {len(status["errors"])}')
