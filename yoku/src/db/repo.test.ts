import Dexie from "dexie";
import { DB_NAMES, YokuDB, destroyDb, getDb } from "./db";
import {
  PHOTO_LIMITS,
  StorageLimitError,
  ValidationError,
  cleanupOrphanPhotos,
  clearAllData,
  countAll,
  deleteFood,
  deleteWellness,
  loadSettings,
  saveBoundary,
  saveFood,
  saveGratitude,
  saveMemory,
  savePhoto,
  savePreference,
  saveSettings,
  saveWellness,
  setGratitudeShared,
  toggleFoodFlag
} from "./repo";
import { seedDemo } from "./demo";
import { buildExport } from "../lib/export";

let db: YokuDB;

beforeEach(async () => {
  await destroyDb("real");
  await destroyDb("demo");
  db = getDb("real");
});

describe("Wellness", () => {
  it("保存・編集・削除。0 と未回答を区別する", async () => {
    const saved = await saveWellness(db, { date: "2026-11-08", scores: { appetite: 0, mood: 6, stress: "" }, sleepHours: "7" });
    expect(saved).toMatchObject({ appetite: 0, mood: 6, sleepHours: 7 });
    const row = await db.wellness.get(saved!.id);
    expect(row?.appetite).toBe(0);
    expect(row && "stress" in row).toBe(false);
    expect(row && "sexualDesire" in row).toBe(false);

    // 同じ日に保存し直すと上書き(1日1件)
    const again = await saveWellness(db, { date: "2026-11-08", scores: { mood: 3 } });
    expect(again!.id).toBe(saved!.id);
    expect(await db.wellness.count()).toBe(1);
    const row2 = await db.wellness.get(saved!.id);
    expect(row2?.mood).toBe(3);
    expect(row2 && "appetite" in row2).toBe(false);
    expect(row2?.createdAt).toBe(saved!.createdAt);

    await deleteWellness(db, saved!.id);
    expect(await db.wellness.count()).toBe(0);
  });

  it("すべて未回答で保存すると、その日の記録を消す", async () => {
    await saveWellness(db, { date: "2026-11-08", scores: { mood: 5 } });
    expect(await saveWellness(db, { date: "2026-11-08", scores: {} })).toBeUndefined();
    expect(await db.wellness.count()).toBe(0);
  });

  it("不正な日付を拒否する", async () => {
    await expect(saveWellness(db, { date: "2026-02-30", scores: { mood: 1 } })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Intimacy", () => {
  it("好み:保存・ステータス変更・削除", async () => {
    const p = await savePreference(db, { title: " ゆっくり ", category: "play", status: "like", tags: ["a", "a"], notes: "" });
    expect(p).toMatchObject({ title: "ゆっくり", tags: ["a"] });
    expect("notes" in p).toBe(false);
    const p2 = await savePreference(db, { title: "ゆっくり", category: "play", status: "not_now" }, p.id);
    expect(p2.status).toBe("not_now");
    expect(p2.createdAt).toBe(p.createdAt);
    expect(await db.intimacyPreferences.count()).toBe(1);
    await db.intimacyPreferences.delete(p.id);
    expect(await db.intimacyPreferences.count()).toBe(0);
  });

  it("好み:名前・分類・ステータスの検証", async () => {
    await expect(savePreference(db, { title: "", category: "x", status: "y" })).rejects.toMatchObject({
      fields: { title: expect.any(String), category: expect.any(String), status: expect.any(String) }
    });
  });

  it("体験の記録は日付が任意で、点数の項目を持たない", async () => {
    const m = await saveMemory(db, { title: "雨の日", positiveExperience: "ゆっくり" });
    expect(m.date).toBeUndefined();
    expect(Object.keys(m)).not.toContain("score");
    await expect(saveMemory(db, { title: "x", date: "bad" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("境界線", async () => {
    const b = await saveBoundary(db, { title: "撮影", status: "no" });
    expect(b.status).toBe("no");
    await expect(saveBoundary(db, { title: "x", status: "maybe" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("HTML やスクリプトは文字列のまま保存する(実行は描画側でされない)", async () => {
    const p = await savePreference(db, { title: "<img src=x onerror=alert(1)>", category: "memo", status: "discuss" });
    expect(p.title).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("Food", () => {
  const blob = (n: number) => new Blob([new Uint8Array(n)], { type: "image/jpeg" });

  it("写真つきで保存し、記録の削除で写真も消える", async () => {
    const photo = await savePhoto(db, { blob: blob(1000), width: 10, height: 10 });
    const f = await saveFood(db, { date: "2026-11-01", dishName: "パスタ", genre: "italian", photoId: photo.id, wantAgain: true });
    expect(f.photoId).toBe(photo.id);
    expect(await db.photos.count()).toBe(1);
    await deleteFood(db, f.id);
    expect(await db.foods.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
  });

  it("写真を差し替えると古い写真を消し、外すと写真を消す", async () => {
    const p1 = await savePhoto(db, { blob: blob(10), width: 1, height: 1 });
    const f = await saveFood(db, { date: "2026-11-01", dishName: "a", genre: "other", photoId: p1.id });
    const p2 = await savePhoto(db, { blob: blob(10), width: 1, height: 1 });
    await saveFood(db, { date: "2026-11-01", dishName: "a", genre: "other", photoId: p2.id }, f.id);
    expect(await db.photos.get(p1.id)).toBeUndefined();
    // 写真を指定せずに保存し直しても写真は残る
    await saveFood(db, { date: "2026-11-01", dishName: "b", genre: "other" }, f.id);
    expect((await db.foods.get(f.id))?.photoId).toBe(p2.id);
    await saveFood(db, { date: "2026-11-01", dishName: "a", genre: "other", photoId: null }, f.id);
    expect(await db.photos.count()).toBe(0);
    expect((await db.foods.get(f.id))?.photoId).toBeUndefined();
  });

  it("保存容量の上限を超える写真を拒否する", async () => {
    await expect(savePhoto(db, { blob: blob(PHOTO_LIMITS.maxStoredBytes + 1), width: 1, height: 1 })).rejects.toBeInstanceOf(StorageLimitError);
  });

  it("参照されていない写真を掃除する", async () => {
    await savePhoto(db, { blob: blob(10), width: 1, height: 1 });
    expect(await cleanupOrphanPhotos(db)).toBe(1);
    expect(await db.photos.count()).toBe(0);
  });

  it("お気に入り・また食べたいの切り替えと、不明なジャンルの扱い", async () => {
    const f = await saveFood(db, { date: "2026-11-01", dishName: "a", genre: "unknown" });
    expect(f.genre).toBe("other");
    await toggleFoodFlag(db, f.id, "favorite");
    expect((await db.foods.get(f.id))?.favorite).toBe(true);
    await toggleFoodFlag(db, f.id, "favorite");
    expect((await db.foods.get(f.id))?.favorite).toBeUndefined();
  });

  it("料理名と日付は必須", async () => {
    await expect(saveFood(db, { date: "", dishName: " ", genre: "other" })).rejects.toMatchObject({
      fields: { dishName: expect.any(String), date: expect.any(String) }
    });
  });
});

describe("Thanks", () => {
  it("記録・編集・「伝えた」の任意管理・削除", async () => {
    const g = await saveGratitude(db, { date: "2026-11-08", reason: "話を聞いてくれた", message: "ありがとう" });
    expect(g.shared).toBeUndefined();
    await setGratitudeShared(db, g.id, true);
    expect((await db.gratitude.get(g.id))?.shared).toBe(true);
    await setGratitudeShared(db, g.id, false);
    expect((await db.gratitude.get(g.id))?.shared).toBeUndefined();
    const g2 = await saveGratitude(db, { date: "2026-11-07", reason: "朝ごはん" }, g.id);
    expect(g2.id).toBe(g.id);
    await db.gratitude.delete(g.id);
    expect(await db.gratitude.count()).toBe(0);
  });
});

describe("IndexedDB への保存と再オープン", () => {
  it("接続を閉じて開き直してもデータが残る", async () => {
    await saveGratitude(db, { date: "2026-11-08", reason: "x" });
    await saveSettings(db, { showIntimacy: false });
    db.close();
    const reopened = new YokuDB(DB_NAMES.real);
    expect(await reopened.gratitude.count()).toBe(1);
    expect((await loadSettings(reopened)).showIntimacy).toBe(false);
    expect(await reopened.meta.get("schemaVersion")).toMatchObject({ value: 1 });
    reopened.close();
  });
});

describe("全データ削除", () => {
  it("clearAllData はすべてのテーブルと設定を空にする", async () => {
    await saveWellness(db, { date: "2026-11-08", scores: { mood: 1 } });
    await savePreference(db, { title: "a", category: "play", status: "like" });
    await saveFood(db, { date: "2026-11-08", dishName: "a", genre: "other" });
    await saveGratitude(db, { date: "2026-11-08", reason: "a" });
    await saveSettings(db, { theme: "dark" });
    await clearAllData(db);
    expect(Object.values(await countAll(db)).every((n) => n === 0)).toBe(true);
    expect((await loadSettings(db)).theme).toBe("system");
  });

  it("destroyDb はデータベース自体を消す", async () => {
    await saveGratitude(db, { date: "2026-11-08", reason: "a" });
    await destroyDb("real");
    expect(await Dexie.exists(DB_NAMES.real)).toBe(false);
    expect(await getDb("real").gratitude.count()).toBe(0);
  });
});

describe("デモデータと実データの分離", () => {
  it("デモは別のデータベースに入り、実データに混ざらない", async () => {
    await saveGratitude(db, { date: "2026-11-08", reason: "本物" });
    const demo = getDb("demo");
    await seedDemo(demo);
    await saveGratitude(demo, { date: "2026-11-08", reason: "デモで追加" });

    expect(await db.gratitude.count()).toBe(1);
    expect(await db.wellness.count()).toBe(0);
    expect(await db.intimacyPreferences.count()).toBe(0);
    expect((await db.gratitude.toArray())[0]!.reason).toBe("本物");

    const demoCounts = await countAll(demo);
    expect(demoCounts.wellness).toBeGreaterThanOrEqual(20);
    expect(demoCounts.intimacyPreferences).toBeGreaterThan(0);
    expect(demoCounts.intimacyBoundaries).toBeGreaterThan(0);
    expect(demoCounts.foods).toBeGreaterThan(0);
    expect(await demo.gratitude.filter((g) => g.reason === "本物").count()).toBe(0);

    await destroyDb("demo");
    expect(await db.gratitude.count()).toBe(1);
  });

  it("デモの Wellness は30日以内で、未回答の日・項目を含む", async () => {
    const demo = getDb("demo");
    await seedDemo(demo);
    const all = await demo.wellness.toArray();
    expect(all.length).toBeLessThanOrEqual(30);
    expect(all.some((e) => e.sexualDesire === undefined)).toBe(true);
  });
});

describe("エクスポート", () => {
  it("すべてのテーブルを含み、写真は data URL になる", async () => {
    const p = await savePhoto(db, { blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), width: 1, height: 1 });
    await saveFood(db, { date: "2026-11-08", dishName: "a", genre: "other", photoId: p.id });
    // jsdom + fake-indexeddb では Blob が構造化複製で失われるため、写真の読み出しだけ差し替える
    // (実ブラウザーでの写真の保存・読み出しは e2e/food-photo.spec.ts で確認)
    const stored = await db.photos.get(p.id);
    vi.spyOn(db.photos, "toArray").mockResolvedValue([{ ...stored!, blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }) }]);
    const out = await buildExport(db);
    expect(out.app).toBe("YOKU");
    expect(Object.keys(out.data).sort()).toEqual(
      ["foods", "gratitude", "intimacyBoundaries", "intimacyMemories", "intimacyPreferences", "photos", "wellness"].sort()
    );
    const photo = out.data.photos![0] as { dataUrl: string; blob?: unknown };
    expect(photo.dataUrl).toBe("data:image/jpeg;base64,AQID");
    expect(photo.blob).toBeUndefined();
  });
});
