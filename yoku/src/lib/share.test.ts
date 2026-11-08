import {
  INTIMACY_OUTRO,
  buildFeelingText,
  buildFoodText,
  buildIntimacyText,
  buildThanksText,
  buildTopicText,
  normalizeShareText
} from "./share";
import type { FoodMemory, GratitudeEntry, IntimacyBoundary, IntimacyPreference } from "../db/types";

const SECRET = "SECRET_NOTE_蜜";
const now = "2026-11-01T00:00:00.000Z";

describe("共有文の下書き(意図しないデータの混入防止)", () => {
  const prefs: IntimacyPreference[] = [
    { id: "1", title: "ゆっくりした時間", category: "play", status: "like", tags: [SECRET], notes: SECRET, createdAt: now, updatedAt: now },
    { id: "2", title: "照明の工夫", category: "interest", status: "discuss", tags: [], createdAt: now, updatedAt: now },
    { id: "3", title: "疲れている日", category: "avoid", status: "not_now", tags: [], notes: SECRET, createdAt: now, updatedAt: now }
  ];
  const boundaries: IntimacyBoundary[] = [
    { id: "b", title: "途中でやめてもいい", status: "yes", notes: SECRET, createdAt: now, updatedAt: now }
  ];

  it("Intimacy:名前とステータスだけが入り、メモ・タグは入らない", () => {
    const t = buildIntimacyText(prefs, boundaries);
    expect(t).toContain("【好き】\n・ゆっくりした時間");
    expect(t).toContain("【相談してみたい】\n・照明の工夫");
    expect(t).toContain("【今は希望しない】\n・疲れている日");
    expect(t).toContain("【これは好き】\n・途中でやめてもいい");
    expect(t).toContain(INTIMACY_OUTRO);
    expect(t).not.toContain(SECRET);
  });

  it("Intimacy:選んでいない項目は入らない", () => {
    const t = buildIntimacyText([prefs[1]!]);
    expect(t).toContain("照明の工夫");
    expect(t).not.toContain("ゆっくりした時間");
    expect(t).not.toContain("疲れている日");
  });

  it("Intimacy:何も選ばなければ空", () => {
    expect(buildIntimacyText([], [])).toBe("");
  });

  it("Food:料理名とお店だけ。メモ・ポイント・同行者・場所・写真は入らない", () => {
    const f: FoodMemory = {
      id: "f",
      date: "2026-11-01",
      dishName: "パスタ",
      genre: "italian",
      restaurantName: "ソーレ",
      location: SECRET,
      highlights: SECRET,
      companion: SECRET,
      notes: SECRET,
      photoId: SECRET,
      createdAt: now,
      updatedAt: now
    };
    const t = buildFoodText([f]);
    expect(t).toBe("この前食べたソーレのパスタがすごく美味しかった。また一緒に行きたい！");
    expect(buildFoodText([f, { ...f, dishName: "タルト", restaurantName: undefined }])).not.toContain(SECRET);
  });

  it("Thanks:伝えたいメッセージを優先し、気持ちの欄は入らない", () => {
    const g: GratitudeEntry = { id: "g", date: "2026-11-01", reason: "朝ごはん", feeling: SECRET, message: "いつもありがとう", createdAt: now, updatedAt: now };
    expect(buildThanksText(g)).toBe("いつもありがとう");
    expect(buildThanksText({ ...g, message: undefined })).toBe("朝ごはん、ありがとう。");
    expect(buildThanksText({ ...g, message: undefined, reason: "話を聞いてくれてありがとう" })).toBe("話を聞いてくれてありがとう。");
    expect(buildThanksText({ ...g, message: undefined })).not.toContain(SECRET);
  });

  it("気持ち・テーマ", () => {
    expect(buildFeelingText(["今日は元気です"], " よろしく ")).toBe("今日は元気です\nよろしく");
    expect(buildFeelingText([])).toBe("");
    expect(buildTopicText("最近うれしかったことは何？")).toContain("最近うれしかったことは何？");
  });

  it("送信前の整形:改行の正規化と長さ制限", () => {
    expect(normalizeShareText("  a\r\n\n\n\nb  ")).toBe("a\n\nb");
    expect(normalizeShareText("x".repeat(5000))).toHaveLength(4000);
  });
});
