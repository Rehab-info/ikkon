/**
 * 料理の写真を端末内で縮小・再エンコードする。
 * canvas に描き直して JPEG にするため、元の EXIF(撮影位置・機種・日時など)は保存されない。
 */
import { PHOTO_LIMITS, StorageLimitError } from "../db/repo";

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const ACCEPT = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i;

export function isAcceptableImage(file: { type: string; size: number }): string | null {
  if (!ACCEPT.test(file.type)) return "画像ファイル(JPEG・PNG・WebP など)を選んでください";
  if (file.size > PHOTO_LIMITS.maxInputBytes) return "25MB より大きい画像は取りこめません";
  return null;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    // imageOrientation: "from-image" で回転情報だけは見た目に反映してから捨てる
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像を変換できませんでした"))), "image/jpeg", quality);
  });
}

export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const problem = isAcceptableImage(file);
  if (problem) throw new StorageLimitError(problem);
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new StorageLimitError("この画像は読みこめませんでした(HEIC はブラウザーによって未対応です)");
  }
  try {
    let max: number = PHOTO_LIMITS.maxDimension;
    let quality = 0.82;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { width, height } = fitWithin(decoded.width, decoded.height, max);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new StorageLimitError("画像を処理できませんでした");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(decoded.source, 0, 0, width, height);
      const blob = await toBlob(canvas, quality);
      if (blob.size <= PHOTO_LIMITS.maxStoredBytes) return { blob, width, height };
      max = Math.round(max * 0.8);
      quality = Math.max(0.6, quality - 0.06);
    }
    throw new StorageLimitError("画像を十分に小さくできませんでした");
  } finally {
    decoded.close();
  }
}
