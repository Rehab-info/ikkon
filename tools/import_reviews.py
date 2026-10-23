"""Google フォームの回答(CSV)から、掲載するレビューだけを data/reviews.json に取り込むスクリプト。
使い方: python3 tools/import_reviews.py 回答.csv

回答のスプレッドシートに「掲載」という列を足し、載せる行に ○ をつけてから、
「ファイル → ダウンロード → カンマ区切り形式(.csv)」で保存して、このスクリプトに渡してください。
毎回 CSV の内容で作り直すので、載せるのをやめるときは ○ を消して実行し直せば消えます。
"""
import csv
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/reviews.json"
sakes = json.loads((ROOT / "data/sakes.json").read_text(encoding="utf-8"))
by_name = {s["name"]: s["id"] for s in sakes}
by_id = {s["id"] for s in sakes}
YES = {"○", "◯", "〇", "はい", "yes", "true", "1"}
COLUMNS = ["タイムスタンプ", "銘柄", "評価", "ニックネーム", "レビュー", "掲載"]

if len(sys.argv) != 2:
    raise SystemExit("使い方: python3 tools/import_reviews.py 回答.csv")

with open(sys.argv[1], encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
missing = [c for c in COLUMNS if rows and c not in rows[0]]
if missing:
    raise SystemExit("CSV に次の列がありません: " + "、".join(missing))

reviews, errors = [], []
for n, row in enumerate(rows, start=2):  # 1行目は見出し
    if row["掲載"].strip().lower() not in YES:
        continue
    name = row["銘柄"].strip()
    sake = by_name.get(name) or (name if name in by_id else None)
    if not sake:
        errors.append(f"{n}行目: 銘柄「{name}」が data/sakes.json にありません")
    try:
        stars = int(row["評価"].strip())
        if not 1 <= stars <= 5:
            raise ValueError
    except ValueError:
        errors.append(f"{n}行目: 評価「{row['評価']}」は 1〜5 の数で書いてください")
        continue
    stamp = row["タイムスタンプ"].strip().split(" ")[0].replace("/", "-")
    try:
        date = datetime.date.fromisoformat("-".join(p.zfill(2) for p in stamp.split("-"))).isoformat()
    except ValueError:
        errors.append(f"{n}行目: タイムスタンプ「{row['タイムスタンプ']}」が読めません")
        continue
    text = row["レビュー"].strip()
    if not text:
        errors.append(f"{n}行目: レビューの本文がありません")
    reviews.append({"sake": sake, "stars": stars, "name": row["ニックネーム"].strip() or "匿名", "date": date, "text": text})

if errors:
    raise SystemExit("取り込めませんでした:\n" + "\n".join(errors))

data = json.loads(OUT.read_text(encoding="utf-8"))
data["reviews"] = sorted(reviews, key=lambda r: r["date"], reverse=True)
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"data/reviews.json に {len(reviews)} 件を載せました")
