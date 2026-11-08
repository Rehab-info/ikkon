import { cleanScore, cleanSleepHours, cleanTags, cleanText, cleanWellnessScores, compact } from "./validate";

describe("validate", () => {
  it("0 は有効な回答、空は未回答", () => {
    expect(cleanScore(0)).toBe(0);
    expect(cleanScore("0")).toBe(0);
    expect(cleanScore("")).toBeUndefined();
    expect(cleanScore(null)).toBeUndefined();
    expect(cleanScore(undefined)).toBeUndefined();
  });
  it("範囲外・数値でない値は未回答として扱う", () => {
    expect(cleanScore(11)).toBeUndefined();
    expect(cleanScore(-1)).toBeUndefined();
    expect(cleanScore("abc")).toBeUndefined();
    expect(cleanScore(Number.NaN)).toBeUndefined();
    expect(cleanScore(6.6)).toBe(7);
  });
  it("睡眠時間は 0〜24 を 15 分単位に丸める", () => {
    expect(cleanSleepHours("6.6")).toBe(6.5);
    expect(cleanSleepHours(0)).toBe(0);
    expect(cleanSleepHours(25)).toBeUndefined();
    expect(cleanSleepHours("")).toBeUndefined();
  });
  it("テキストの制御文字を除き、長さを制限する", () => {
    expect(cleanText("  a\u0000b\nc  ")).toBe("ab\nc");
    expect(cleanText("   ")).toBeUndefined();
    expect(cleanText("x".repeat(3000))).toHaveLength(2000);
    expect(cleanText(123)).toBeUndefined();
  });
  it("タグは重複を除き最大10個", () => {
    expect(cleanTags(["a", "a", " b ", "", 1])).toEqual(["a", "b"]);
    expect(cleanTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(10);
  });
  it("Wellness のスコアは未回答のキーを持たない", () => {
    const s = cleanWellnessScores({ appetite: 0, mood: "", stress: 5, sleepiness: undefined });
    expect(s).toEqual({ appetite: 0, stress: 5 });
    expect("mood" in s).toBe(false);
  });
  it("compact は undefined だけを取り除く(0 と false は残す)", () => {
    expect(compact({ a: 0, b: undefined, c: false, d: "" })).toEqual({ a: 0, c: false, d: "" });
  });
});
