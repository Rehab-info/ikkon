"""CSS・JS のキャッシュ対策の番号(?v=)を、すべてのページでまとめて1つ上げるスクリプト。
使い方: python3 tools/bump_version.py
assets/style.css や assets/app.js を直したら実行してください(kura.html も作り直します)。
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "guide.html", "miyagi.html"]

old = re.search(r"style\.css\?v=(\d+)", (ROOT / "index.html").read_text(encoding="utf-8")).group(1)
new = str(int(old) + 1)
for name in PAGES:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    path.write_text(re.sub(r"(\.(?:css|js)\?v=)\d+", r"\g<1>" + new, text), encoding="utf-8")
subprocess.run([sys.executable, str(ROOT / "tools/build_kura.py")], check=True)
print(f"v={old} → v={new}")
