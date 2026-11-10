import { AppError } from '@buddyship/shared';

export const MAX_SIDE = 1600;
export const MAX_INPUT_BYTES = 30 * 1024 * 1024;

/** 写真を読めなかった理由(画面で、次に何をすればよいかを案内する) */
export class PhotoError extends Error {
  constructor(
    readonly kind: 'not_image' | 'too_large' | 'unreadable',
    readonly heic: boolean,
  ) {
    super(kind);
    this.name = 'PhotoError';
  }
}

export function photoErrorText(e: PhotoError): string {
  switch (e.kind) {
    case 'not_image':
      return '写真のファイルを選んでください。';
    case 'too_large':
      return '写真が大きすぎて読み込めません(30 MB まで)。もう一度撮るか、「写真なしで記録する」を使ってください。';
    case 'unreadable':
      return e.heic
        ? 'この写真の形式(HEIC)は、この端末では読み込めませんでした。iPhone なら「設定」→「カメラ」→「フォーマット」で「互換性優先」にしてから撮り直すか、「写真なしで記録する」を使ってください。'
        : 'この写真を読み込めませんでした。もう一度撮るか、「写真なしで記録する」を使ってください。';
  }
}

const isHeic = (file: File) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/**
 * 食事の写真を端末で縮小し、JPEG に描き直す(位置情報などのメタデータを取り除く。SECURITY §5)。
 * 読めない形式(一部の HEIC など)はエラーにして、写真なしの記録を案内する。
 */
export async function prepareMealPhoto(file: File): Promise<Blob> {
  const heic = isHeic(file);
  // 種類が空のことがある(一部の端末の HEIC)。拡張子で HEIC と分かるものは読み込みを試す
  if (!file.type.startsWith('image/') && !heic) throw new PhotoError('not_image', false);
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('too_large', heic);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError('unreadable', heic);
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
