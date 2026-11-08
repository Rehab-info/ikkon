import type { YokuDB } from "./db";
import { DATA_TABLES } from "./db";
import type {
  BoundaryStatus,
  FoodGenre,
  FoodMemory,
  GratitudeEntry,
  IntimacyBoundary,
  IntimacyCategory,
  IntimacyMemory,
  IntimacyPreference,
  IntimacyPreferenceStatus,
  Settings,
  StoredPhoto,
  WellnessEntry,
  WellnessScoreKey
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { newId } from "../lib/id";
import { nowISO, todayISO } from "../lib/date";
import {
  LIMITS,
  cleanDate,
  cleanSleepHours,
  cleanTags,
  cleanText,
  cleanWellnessScores,
  compact,
  isBoundaryStatus,
  isCategory,
  isGenre,
  isPrefStatus,
  requireText,
  type FieldErrors
} from "../lib/validate";

export class ValidationError extends Error {
  constructor(public readonly fields: FieldErrors) {
    super(Object.values(fields).join(" / "));
    this.name = "ValidationError";
  }
}

function assertValid(errors: FieldErrors) {
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}

/* ---------------- Settings ---------------- */

export async function loadSettings(db: YokuDB): Promise<Settings> {
  const row = await db.settings.get("settings");
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(db: YokuDB, patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings(db)), ...patch };
  await db.settings.put({ key: "settings", value: next });
  return next;
}

/* ---------------- Wellness ---------------- */

export interface WellnessInput {
  date: string;
  scores: Partial<Record<WellnessScoreKey, unknown>>;
  sleepHours?: unknown;
}

/** 日付ごとに1件。同じ日に保存し直すと上書きする。全項目が未回答なら記録を消す */
export async function saveWellness(db: YokuDB, input: WellnessInput): Promise<WellnessEntry | undefined> {
  const date = cleanDate(input.date);
  if (!date) throw new ValidationError({ date: "日付が正しくありません" });
  const scores = cleanWellnessScores(input.scores);
  const sleepHours = cleanSleepHours(input.sleepHours);
  return db.transaction("rw", db.wellness, async () => {
    const existing = await db.wellness.where("date").equals(date).first();
    const empty = Object.keys(scores).length === 0 && sleepHours === undefined;
    if (empty) {
      if (existing) await db.wellness.delete(existing.id);
      return undefined;
    }
    const now = nowISO();
    const entry: WellnessEntry = compact({
      id: existing?.id ?? newId(),
      date,
      ...scores,
      sleepHours,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    await db.wellness.put(entry);
    return entry;
  });
}

export async function deleteWellness(db: YokuDB, id: string) {
  await db.wellness.delete(id);
}

export async function wellnessInRange(db: YokuDB, from: string, to: string) {
  return db.wellness.where("date").between(from, to, true, true).sortBy("date");
}

/* ---------------- Intimacy ---------------- */

export interface PreferenceInput {
  title: unknown;
  category: unknown;
  status: unknown;
  tags?: unknown;
  notes?: unknown;
}

export async function savePreference(db: YokuDB, input: PreferenceInput, id?: string): Promise<IntimacyPreference> {
  const errors: FieldErrors = {};
  const title = requireText(errors, "title", input.title, "名前", LIMITS.title);
  if (!isCategory(input.category)) errors.category = "分類を選んでください";
  if (!isPrefStatus(input.status)) errors.status = "ステータスを選んでください";
  assertValid(errors);
  const now = nowISO();
  const existing = id ? await db.intimacyPreferences.get(id) : undefined;
  const item: IntimacyPreference = compact({
    id: existing?.id ?? newId(),
    title,
    category: input.category as IntimacyCategory,
    status: input.status as IntimacyPreferenceStatus,
    tags: cleanTags(input.tags),
    notes: cleanText(input.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
  await db.intimacyPreferences.put(item);
  return item;
}

export interface MemoryInput {
  date?: unknown;
  title: unknown;
  positiveExperience?: unknown;
  feelings?: unknown;
  wouldLikeAgain?: unknown;
  notes?: unknown;
}

export async function saveMemory(db: YokuDB, input: MemoryInput, id?: string): Promise<IntimacyMemory> {
  const errors: FieldErrors = {};
  const title = requireText(errors, "title", input.title, "タイトル", LIMITS.title);
  if (input.date !== undefined && input.date !== "" && !cleanDate(input.date)) errors.date = "日付が正しくありません";
  assertValid(errors);
  const now = nowISO();
  const existing = id ? await db.intimacyMemories.get(id) : undefined;
  const item: IntimacyMemory = compact({
    id: existing?.id ?? newId(),
    date: cleanDate(input.date),
    title,
    positiveExperience: cleanText(input.positiveExperience),
    feelings: cleanText(input.feelings),
    wouldLikeAgain: cleanText(input.wouldLikeAgain),
    notes: cleanText(input.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
  await db.intimacyMemories.put(item);
  return item;
}

export interface BoundaryInput {
  title: unknown;
  status: unknown;
  notes?: unknown;
}

export async function saveBoundary(db: YokuDB, input: BoundaryInput, id?: string): Promise<IntimacyBoundary> {
  const errors: FieldErrors = {};
  const title = requireText(errors, "title", input.title, "内容", LIMITS.title);
  if (!isBoundaryStatus(input.status)) errors.status = "気持ちを選んでください";
  assertValid(errors);
  const now = nowISO();
  const existing = id ? await db.intimacyBoundaries.get(id) : undefined;
  const item: IntimacyBoundary = compact({
    id: existing?.id ?? newId(),
    title,
    status: input.status as BoundaryStatus,
    notes: cleanText(input.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
  await db.intimacyBoundaries.put(item);
  return item;
}

/* ---------------- Food ---------------- */

export const PHOTO_LIMITS = {
  /** 取りこみ前の元画像の上限 */
  maxInputBytes: 25 * 1024 * 1024,
  /** 保存する写真1枚の上限(圧縮後) */
  maxStoredBytes: 1.5 * 1024 * 1024,
  /** 写真全体の上限 */
  maxTotalBytes: 150 * 1024 * 1024,
  maxDimension: 1600
} as const;

export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageLimitError";
  }
}

export async function totalPhotoBytes(db: YokuDB): Promise<number> {
  let total = 0;
  await db.photos.each((p) => {
    total += p.size;
  });
  return total;
}

export async function savePhoto(
  db: YokuDB,
  photo: { blob: Blob; width: number; height: number }
): Promise<StoredPhoto> {
  if (photo.blob.size > PHOTO_LIMITS.maxStoredBytes) throw new StorageLimitError("写真のサイズが大きすぎます");
  const total = await totalPhotoBytes(db);
  if (total + photo.blob.size > PHOTO_LIMITS.maxTotalBytes)
    throw new StorageLimitError("写真の保存容量の上限に達しました。古い写真を削除してください");
  const row: StoredPhoto = {
    id: newId(),
    blob: photo.blob,
    type: photo.blob.type || "image/jpeg",
    size: photo.blob.size,
    width: photo.width,
    height: photo.height,
    createdAt: nowISO()
  };
  await db.photos.add(row);
  return row;
}

export interface FoodInput {
  date: unknown;
  dishName: unknown;
  genre: unknown;
  restaurantName?: unknown;
  location?: unknown;
  highlights?: unknown;
  wantAgain?: unknown;
  favorite?: unknown;
  companion?: unknown;
  notes?: unknown;
  /** undefined: 写真はそのまま / null: 写真を外す(削除) / string: 新しい写真の id */
  photoId?: string | null;
}

export async function saveFood(db: YokuDB, input: FoodInput, id?: string): Promise<FoodMemory> {
  const errors: FieldErrors = {};
  const dishName = requireText(errors, "dishName", input.dishName, "料理名", LIMITS.title);
  const date = cleanDate(input.date);
  if (!date) errors.date = "食べた日を入れてください";
  assertValid(errors);
  return db.transaction("rw", db.foods, db.photos, async () => {
    const existing = id ? await db.foods.get(id) : undefined;
    let photoId = existing?.photoId;
    if (input.photoId !== undefined) {
      if (existing?.photoId && existing.photoId !== input.photoId) await db.photos.delete(existing.photoId);
      photoId = input.photoId ?? undefined;
    }
    const now = nowISO();
    const item: FoodMemory = compact({
      id: existing?.id ?? newId(),
      date: date ?? todayISO(),
      dishName,
      genre: isGenre(input.genre) ? (input.genre as FoodGenre) : "other",
      restaurantName: cleanText(input.restaurantName, LIMITS.short),
      location: cleanText(input.location, LIMITS.short),
      photoId,
      highlights: cleanText(input.highlights),
      wantAgain: input.wantAgain === true ? true : undefined,
      favorite: input.favorite === true ? true : undefined,
      companion: cleanText(input.companion, LIMITS.short),
      notes: cleanText(input.notes),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    await db.foods.put(item);
    return item;
  });
}

/** 記録と、その写真をいっしょに削除する */
export async function deleteFood(db: YokuDB, id: string) {
  await db.transaction("rw", db.foods, db.photos, async () => {
    const f = await db.foods.get(id);
    if (f?.photoId) await db.photos.delete(f.photoId);
    await db.foods.delete(id);
  });
}

export async function toggleFoodFlag(db: YokuDB, id: string, flag: "favorite" | "wantAgain") {
  await db.transaction("rw", db.foods, async () => {
    const f = await db.foods.get(id);
    if (!f) return;
    const next = { ...f, updatedAt: nowISO() };
    if (f[flag]) delete next[flag];
    else next[flag] = true;
    await db.foods.put(next);
  });
}

/** どの記録からも参照されていない写真(保存途中で中断した場合など)を消す */
export async function cleanupOrphanPhotos(db: YokuDB): Promise<number> {
  return db.transaction("rw", db.foods, db.photos, async () => {
    const used = new Set<string>();
    await db.foods.each((f) => {
      if (f.photoId) used.add(f.photoId);
    });
    const orphan: string[] = [];
    await db.photos.each((p) => {
      if (!used.has(p.id)) orphan.push(p.id);
    });
    await db.photos.bulkDelete(orphan);
    return orphan.length;
  });
}

/* ---------------- Thanks ---------------- */

export interface GratitudeInput {
  date: unknown;
  recipient?: unknown;
  reason: unknown;
  feeling?: unknown;
  message?: unknown;
  shared?: unknown;
}

export async function saveGratitude(db: YokuDB, input: GratitudeInput, id?: string): Promise<GratitudeEntry> {
  const errors: FieldErrors = {};
  const reason = requireText(errors, "reason", input.reason, "感謝していること", LIMITS.text);
  const date = cleanDate(input.date);
  if (!date) errors.date = "日付を入れてください";
  assertValid(errors);
  const now = nowISO();
  const existing = id ? await db.gratitude.get(id) : undefined;
  const item: GratitudeEntry = compact({
    id: existing?.id ?? newId(),
    date: date ?? todayISO(),
    recipient: cleanText(input.recipient, LIMITS.short),
    reason,
    feeling: cleanText(input.feeling),
    message: cleanText(input.message),
    shared: input.shared === true ? true : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
  await db.gratitude.put(item);
  return item;
}

export async function setGratitudeShared(db: YokuDB, id: string, shared: boolean) {
  const g = await db.gratitude.get(id);
  if (!g) return;
  const next: GratitudeEntry = { ...g, updatedAt: nowISO() };
  if (shared) next.shared = true;
  else delete next.shared;
  await db.gratitude.put(next);
}

/* ---------------- 全体 ---------------- */

export async function countAll(db: YokuDB): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of DATA_TABLES) out[t] = await db.table(t).count();
  return out;
}

export async function clearAllData(db: YokuDB) {
  await db.transaction("rw", [...DATA_TABLES.map((t) => db.table(t)), db.settings], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
    await db.settings.clear();
  });
}
