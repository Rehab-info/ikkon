"""CSS・JS のキャッシュ対策の番号(?v=)を、すべてのページでまとめて1つ上げるスクリプト。
使い方: python3 tools/bump_version.py
assets/style.css や assets/app.js を直したら実行してください(kura.html とコラムのページも作り直します)。

さかづき帳: python3 tools/bump_version.py --sakazuki
sakazuki/ を直したら実行してください。sakazuki/sw.js の VERSION の番号だけを1つ上げます。
入れ替わるのはアプリの画面のキャッシュだけで、端末に保存した記録(IndexedDB・localStorage)には触れません。
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "guide.html", "miyagi.html"]

if "--sakazuki" in sys.argv[1:]:
    sw = ROOT / "sakazuki/sw.js"
    text = sw.read_text(encoding="utf-8")
    m = re.search(r'const VERSION = "sakazuki-beta-(\d+)";', text)
    if not m:
        raise SystemExit("sakazuki/sw.js に VERSION が見つかりません")
    old, new = m.group(1), str(int(m.group(1)) + 1)
    sw.write_text(text.replace(m.group(0), f'const VERSION = "sakazuki-beta-{new}";'), encoding="utf-8")
    print(f"sakazuki-beta-{old} → sakazuki-beta-{new}")
    sys.exit()

old = re.search(r"style\.css\?v=(\d+)", (ROOT / "index.html").read_text(encoding="utf-8")).group(1)
new = str(int(old) + 1)
for name in PAGES:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    path.write_text(re.sub(r"(\.(?:css|js)\?v=)\d+", r"\g<1>" + new, text), encoding="utf-8")
subprocess.run([sys.executable, str(ROOT / "tools/build_kura.py")], check=True)
subprocess.run([sys.executable, str(ROOT / "tools/build_columns.py")], check=True)
print(f"v={old} → v={new}")
