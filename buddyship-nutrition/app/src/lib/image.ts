import { AppError } from '@buddyship/shared';

export const MAX_SIDE = 1600;

/**
 * 食事の写真を端末で縮小し、JPEG に描き直す(位置情報などのメタデータを取り除く。SECURITY §5)。
 * 読めない形式(一部の HEIC など)はエラーにして、写真なしの記録を案内する。
 */
export async function prepareMealPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size > 30 * 1024 * 1024) throw new AppError('invalid_request');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError('invalid_request');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('internal');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new AppError('internal');
  return blob;
}
