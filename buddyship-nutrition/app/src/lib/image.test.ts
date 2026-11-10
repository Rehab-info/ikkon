import { describe, expect, it } from 'vitest';
import { PhotoError, photoErrorText, prepareMealPhoto } from './image.ts';

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

async function errorOf(f: File): Promise<PhotoError> {
  try {
    await prepareMealPhoto(f);
  } catch (e) {
    if (e instanceof PhotoError) return e;
    throw e;
  }
  throw new Error('no error');
}

describe('写真を読めないときの案内', () => {
  it('写真でないファイル', async () => {
    expect((await errorOf(file('a.pdf', 'application/pdf'))).kind).toBe('not_image');
  });

  it('大きすぎる写真', async () => {
    const e = await errorOf(file('a.jpg', 'image/jpeg', 30 * 1024 * 1024 + 1));
    expect(e.kind).toBe('too_large');
    expect(photoErrorText(e)).toContain('写真なしで記録する');
  });

  it('読めない HEIC(種類が空でも拡張子で判断)は、設定の変更と写真なしの記録を案内する', async () => {
    // jsdom には画像の読み込み(createImageBitmap)がないため、読めない写真として扱われる
    const e = await errorOf(file('IMG_0001.HEIC', ''));
    expect(e).toMatchObject({ kind: 'unreadable', heic: true });
    expect(photoErrorText(e)).toContain('互換性優先');
    expect(photoErrorText(e)).toContain('写真なしで記録する');
    const jpeg = await errorOf(file('a.jpg', 'image/jpeg'));
    expect(photoErrorText(jpeg)).not.toContain('HEIC');
  });
});
