import type { YokuDB } from "../db/db";
import { DATA_TABLES, SCHEMA_VERSION } from "../db/db";
import type { StoredPhoto } from "../db/types";
import { loadSettings } from "../db/repo";

export interface ExportFile {
  app: "YOKU";
  formatVersion: 1;
  schemaVersion: number;
  exportedAt: string;
  notice: string;
  settings: unknown;
  data: Record<string, unknown[]>;
}

async function blobToDataUrl(blob: Blob, type: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return `data:${type || "application/octet-stream"};base64,${btoa(bin)}`;
}

export async function buildExport(db: YokuDB): Promise<ExportFile> {
  const data: Record<string, unknown[]> = {};
  for (const t of DATA_TABLES) {
    if (t === "photos") {
      const photos = (await db.photos.toArray()) as StoredPhoto[];
      data.photos = await Promise.all(
        photos.map(async ({ blob, ...rest }) => ({ ...rest, dataUrl: await blobToDataUrl(blob, rest.type) }))
      );
    } else {
      data[t] = await db.table(t).toArray();
    }
  }
  return {
    app: "YOKU",
    formatVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notice:
      "このファイルには性的な好みなどの機微な記録が含まれることがあります。暗号化されていません。保管場所と共有先に注意してください。",
    settings: await loadSettings(db),
    data
  };
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
