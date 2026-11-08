/**
 * 外部通信の静的監査:アプリのソースに、ネットワーク送信を行う API や外部 URL が含まれていないことを確かめる。
 * (実行時の監査は e2e/network.spec.ts で、ブラウザーのすべてのリクエストを記録して行う)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && !p.includes(`${"/"}test${"/"}`) ? [p] : [];
  });
}

const FORBIDDEN: [string, RegExp][] = [
  ["fetch()", /\bfetch\s*\(/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["sendBeacon", /sendBeacon/],
  ["WebSocket", /WebSocket/],
  ["EventSource", /EventSource/],
  ["RTCPeerConnection", /RTCPeerConnection/],
  ["Notification API", /\bnew Notification\b|showNotification/],
  ["geolocation", /geolocation/],
  ["外部URL", /https?:\/\/(?!www\.w3\.org)/]
];

describe("外部通信の静的監査", () => {
  const list = files(ROOT);
  it("監査対象のソースがある", () => {
    expect(list.length).toBeGreaterThan(20);
  });
  for (const [name, re] of FORBIDDEN) {
    it(`${name} を使っていない`, () => {
      const hits = list.filter((f) => re.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
      expect(hits).toEqual([]);
    });
  }
  it("dangerouslySetInnerHTML / innerHTML / eval を使っていない", () => {
    const hits = list
      .filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\(|new Function\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
  it("広告・解析 SDK を依存関係に入れていない", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "..", "package.json"), "utf8")) as { dependencies: Record<string, string> };
    const deps = Object.keys(pkg.dependencies);
    expect(deps.sort()).toEqual(["dexie", "dexie-react-hooks", "lucide-react", "react", "react-dom", "recharts"].sort());
  });
});
