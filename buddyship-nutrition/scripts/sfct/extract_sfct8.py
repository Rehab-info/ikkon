#!/usr/bin/env python3
"""
日本食品標準成分表(八訂)増補2023年の公式 Excel から、Phase 1 で使う 4 成分を取り出す。

使い方:
  python3 -I scripts/sfct/extract_sfct8.py <公式 Excel のパス> <出力 JSON のパス>

- 取得元:https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx
- ファイルの SHA-256 が想定と違えば止まる(別の版を黙って取り込まない)
- 見出し(成分識別子・単位・列名)を読み取ったまま JSON に残し、対応関係は TS 側のテストで検証する
- 値は Excel に入っている形のまま(数値または "(9.7)" "Tr" "-" などの文字列)残す。解釈は packages/nutrition が行う
"""
import hashlib
import json
import sys

import openpyxl

EXPECTED_SHA256 = "0d5a77077dd6cd91cbc2e6e317b8b218a38728c409eed452f1c10635a0d3099c"
SHEET = "表全体"
UNIT_ROW = 11        # 単位(kJ, kcal, g ...)
IDENTIFIER_ROW = 12  # 成分識別子(INFOODS タグ)
FIRST_DATA_ROW = 13
IDENTIFIERS = ["ENERC_KCAL", "PROT-", "FAT-", "CHOCDF-"]
# 参考:誤って使わないことを確認するための近い列
NEIGHBORS = ["ENERC", "PROTCAA", "FATNLEA", "CHOAVL", "CHOAVLM", "CHOAVLDF-"]


def main(src: str, dst: str) -> None:
    with open(src, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    if digest != EXPECTED_SHA256:
        sys.exit(f"SHA-256 mismatch: {digest} (expected {EXPECTED_SHA256}). 新しい版なら確認のうえ定数を更新すること")

    ws = openpyxl.load_workbook(src, read_only=True, data_only=True)[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    ids = rows[IDENTIFIER_ROW - 1]
    units = rows[UNIT_ROW - 1]

    def header(identifier: str) -> dict:
        i = ids.index(identifier)
        labels = [str(rows[r][i]).replace("\n", " ").strip() for r in range(1, IDENTIFIER_ROW - 2) if rows[r][i]]
        # 単位は結合セルのため、左方向で最初に見つかる値
        unit = next((units[j] for j in range(i, -1, -1) if units[j]), None)
        # 列名は結合セルのため、同じ行で左方向に最初に見つかる見出し
        group = next((str(rows[2][j]).strip() for j in range(i, -1, -1) if rows[2][j]), None)
        return {
            "identifier": identifier,
            "column": openpyxl.utils.get_column_letter(i + 1),
            "labels": labels,
            "group_label": group.replace("　", "").replace(" ", "") if group else None,
            "unit_cell": units[i],
            "unit": str(unit),
        }

    cols = {name: ids.index(name) for name in IDENTIFIERS}
    foods = []
    for r in rows[FIRST_DATA_ROW - 1:]:
        if not r[1]:
            continue
        foods.append({
            "code": str(r[1]),
            "group": str(r[0]),
            "name": str(r[3]),
            "values": {name: r[i] for name, i in cols.items()},
        })

    out = {
        "source": {
            "title": "日本食品標準成分表(八訂)増補2023年",
            "file_url": "https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx",
            "sha256": digest,
            "sheet": SHEET,
            "unit_row": UNIT_ROW,
            "identifier_row": IDENTIFIER_ROW,
            "first_data_row": FIRST_DATA_ROW,
        },
        "headers": [header(n) for n in IDENTIFIERS],
        "neighbors": [header(n) for n in NEIGHBORS],
        "food_count": len(foods),
        "foods": foods,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {len(foods)} foods to {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
