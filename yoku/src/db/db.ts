import Dexie, { type EntityTable } from "dexie";
import type {
  DataMode,
  FoodMemory,
  GratitudeEntry,
  IntimacyBoundary,
  IntimacyMemory,
  IntimacyPreference,
  MetaRow,
  SettingRow,
  StoredPhoto,
  WellnessEntry
} from "./types";

export const SCHEMA_VERSION = 1;

/** 実データとデモデータは、別々の IndexedDB データベースに分けて保存する */
export const DB_NAMES: Record<DataMode, string> = {
  real: "yoku",
  demo: "yoku-demo"
};

export class YokuDB extends Dexie {
  wellness!: EntityTable<WellnessEntry, "id">;
  intimacyPreferences!: EntityTable<IntimacyPreference, "id">;
  intimacyMemories!: EntityTable<IntimacyMemory, "id">;
  intimacyBoundaries!: EntityTable<IntimacyBoundary, "id">;
  foods!: EntityTable<FoodMemory, "id">;
  photos!: EntityTable<StoredPhoto, "id">;
  gratitude!: EntityTable<GratitudeEntry, "id">;
  settings!: EntityTable<SettingRow, "key">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name: string) {
    super(name);
    // スキーマを変えるときは version(2) を足し、必要なら .upgrade() でデータを移す(DATA_MODEL.md)
    this.version(1).stores({
      wellness: "id, &date",
      intimacyPreferences: "id, category, status, updatedAt",
      intimacyMemories: "id, date, createdAt",
      intimacyBoundaries: "id, status, updatedAt",
      foods: "id, date, genre",
      photos: "id",
      gratitude: "id, date",
      settings: "key",
      meta: "key"
    });
    this.on("populate", (tx) => {
      void tx.table("meta").add({ key: "schemaVersion", value: SCHEMA_VERSION });
    });
  }
}

const instances = new Map<DataMode, YokuDB>();

export function getDb(mode: DataMode): YokuDB {
  let db = instances.get(mode);
  if (!db) {
    db = new YokuDB(DB_NAMES[mode]);
    instances.set(mode, db);
  }
  return db;
}

/** データベースを完全に削除する(次に getDb したときは空から作り直す) */
export async function destroyDb(mode: DataMode): Promise<void> {
  const db = instances.get(mode);
  if (db) {
    db.close();
    instances.delete(mode);
  }
  await Dexie.delete(DB_NAMES[mode]);
}

export const DATA_TABLES = [
  "wellness",
  "intimacyPreferences",
  "intimacyMemories",
  "intimacyBoundaries",
  "foods",
  "photos",
  "gratitude"
] as const;
export type DataTable = (typeof DATA_TABLES)[number];
