/**
 * デモモード用の架空データ。デモ専用データベース(yoku-demo)にだけ書きこむ。
 * 成人どうしの合意ある関係を前提にし、露骨な表現は使わない。
 */
import type { YokuDB } from "./db";
import type {
  FoodMemory,
  GratitudeEntry,
  IntimacyBoundary,
  IntimacyMemory,
  IntimacyPreference,
  WellnessEntry
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { addDays, todayISO } from "../lib/date";
import { newId } from "../lib/id";

/** 再現性のある疑似乱数(毎回同じデモになる) */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

export function buildDemoWellness(end = todayISO()): WellnessEntry[] {
  const r = rng(20261108);
  const out: WellnessEntry[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = addDays(end, -i);
    const roll = r();
    if (roll < 0.1) continue; // ときどき記録しない日がある
    const weekend = [0, 6].includes(new Date(date + "T12:00:00").getDay());
    const sleepHours = Math.round((6 + r() * 2.5 + (weekend ? 0.8 : 0)) * 4) / 4;
    const rest = clamp(sleepHours - 1.5 + r() * 2);
    const stress = clamp((weekend ? 2 : 5) + r() * 3 - (rest - 5) * 0.3);
    const now = new Date().toISOString();
    const e: WellnessEntry = {
      id: newId(),
      date,
      appetite: clamp(5 + r() * 3 - 1),
      sleepiness: clamp(8 - rest * 0.6 + r() * 2),
      stress,
      mood: clamp(7 - stress * 0.4 + r() * 2),
      fatigue: clamp(4 + r() * 3 + (weekend ? -1.5 : 0.5)),
      sleepRestfulness: rest,
      sleepHours,
      createdAt: now,
      updatedAt: now
    };
    // 性的な関心は答えない日も多い(未回答と 0 は別物として扱う)
    if (r() < 0.6) e.sexualDesire = clamp(3 + r() * 4 + (weekend ? 1 : 0));
    // 一部の日は睡眠時間を未入力に
    if (r() < 0.1) delete e.sleepHours;
    out.push(e);
  }
  return out;
}

export async function seedDemo(db: YokuDB): Promise<void> {
  const now = new Date().toISOString();
  const today = todayISO();
  const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const pref = (
    title: string,
    category: IntimacyPreference["category"],
    status: IntimacyPreference["status"],
    tags: string[] = [],
    notes?: string,
    daysAgo = 3
  ): IntimacyPreference => ({
    id: newId(),
    title,
    category,
    status,
    tags,
    ...(notes ? { notes } : {}),
    createdAt: stamp(daysAgo + 10),
    updatedAt: stamp(daysAgo)
  });
  const prefs: IntimacyPreference[] = [
    pref("寄りそってゆっくりする時間", "play", "like", ["ゆっくり"], "急がない雰囲気が好き"),
    pref("向かい合う姿勢", "position", "like", ["安心感"]),
    pref("キスとハグを長めに", "play", "like", ["ふれあい"]),
    pref("マッサージから始める", "interest", "curious", ["リラックス"]),
    pref("照明や音楽で雰囲気をつくる", "interest", "discuss", ["雰囲気"]),
    pref("週末の朝の時間", "again", "like", ["週末"]),
    pref("旅行先でのふたりの時間", "again", "curious", ["旅行"]),
    pref("疲れている平日の夜", "avoid", "not_now", [], undefined, 40),
    pref("急に始めること", "dislike", "avoid", ["合図がほしい"]),
    pref("新しいことは事前に話してから", "memo", "discuss", [], "その場で決めるより、前もって話せると安心")
  ];
  const memories: IntimacyMemory[] = [
    {
      id: newId(),
      date: addDays(today, -6),
      title: "雨の日曜日",
      positiveExperience: "時間を気にせず、ゆっくり過ごせた",
      feelings: "大切にされていると感じた",
      wouldLikeAgain: "予定のない休日にまた",
      createdAt: now,
      updatedAt: now
    },
    {
      id: newId(),
      date: addDays(today, -21),
      title: "記念日の夜",
      positiveExperience: "たくさん話してから、自然な流れになった",
      feelings: "安心できて、うれしかった",
      createdAt: now,
      updatedAt: now
    }
  ];
  const boundaries: IntimacyBoundary[] = [
    { id: newId(), title: "その日の気分で、断ってもいいこと", status: "yes", createdAt: now, updatedAt: now },
    { id: newId(), title: "途中でやめたくなったら、すぐ伝えること", status: "yes", createdAt: now, updatedAt: now },
    { id: newId(), title: "新しいことを試すタイミング", status: "discuss", createdAt: now, updatedAt: now },
    { id: newId(), title: "写真や動画を撮ること", status: "no", createdAt: now, updatedAt: now },
    { id: newId(), title: "頻度について", status: "undecided", createdAt: now, updatedAt: now }
  ];
  const food = (
    daysAgo: number,
    dishName: string,
    genre: FoodMemory["genre"],
    extra: Partial<FoodMemory> = {}
  ): FoodMemory => ({
    id: newId(),
    date: addDays(today, -daysAgo),
    dishName,
    genre,
    createdAt: now,
    updatedAt: now,
    ...extra
  });
  const foods: FoodMemory[] = [
    food(2, "トマトとバジルのパスタ", "italian", {
      restaurantName: "トラットリア・ソーレ(架空)",
      location: "駅の近く",
      highlights: "麺のもちもち感とトマトの甘さ",
      wantAgain: true,
      favorite: true,
      companion: "パートナー"
    }),
    food(5, "土鍋の炊きこみご飯", "homemade", { highlights: "おこげが香ばしかった", wantAgain: true, companion: "パートナー" }),
    food(9, "小籠包", "chinese", { restaurantName: "点心楼(架空)", highlights: "スープがあふれる", favorite: true }),
    food(14, "季節のフルーツタルト", "sweets", { restaurantName: "パティスリー・ミエル(架空)", wantAgain: true }),
    food(20, "朝ごはんのだし巻き卵", "japanese", { highlights: "ふわふわ", companion: "家族" }),
    food(27, "グリーンカレー", "asian", { restaurantName: "バーンタイ(架空)", notes: "辛さは控えめで頼む" })
  ];
  const thanks = (daysAgo: number, reason: string, extra: Partial<GratitudeEntry> = {}): GratitudeEntry => ({
    id: newId(),
    date: addDays(today, -daysAgo),
    reason,
    createdAt: now,
    updatedAt: now,
    ...extra
  });
  const gratitude: GratitudeEntry[] = [
    thanks(0, "朝ごはんを作ってくれた", {
      recipient: "パートナー",
      feeling: "あたたかい気持ちになった",
      message: "朝ごはん、ありがとう。おかげで一日がんばれそう。"
    }),
    thanks(1, "話を聞いてくれてありがとう", { recipient: "パートナー", feeling: "ほっとした", shared: true }),
    thanks(4, "仕事で疲れていたとき、そっとしておいてくれた", { recipient: "パートナー" }),
    thanks(8, "誕生日を覚えていてくれた", { recipient: "友人", shared: true }),
    thanks(12, "一緒に過ごしてくれてありがとう", { recipient: "パートナー", message: "週末、一緒にいてくれてありがとう。楽しかった！" })
  ];
  await db.transaction(
    "rw",
    [db.wellness, db.intimacyPreferences, db.intimacyMemories, db.intimacyBoundaries, db.foods, db.gratitude, db.settings, db.meta],
    async () => {
      await db.wellness.bulkAdd(buildDemoWellness(today));
      await db.intimacyPreferences.bulkAdd(prefs);
      await db.intimacyMemories.bulkAdd(memories);
      await db.intimacyBoundaries.bulkAdd(boundaries);
      await db.foods.bulkAdd(foods);
      await db.gratitude.bulkAdd(gratitude);
      await db.settings.put({ key: "settings", value: { ...DEFAULT_SETTINGS, adultConfirmed: true } });
      await db.meta.put({ key: "isDemo", value: true });
    }
  );
}
