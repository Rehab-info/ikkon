/**
 * 画像の検証(SECURITY §5)。拡張子や Content-Type を信じず、ファイルの中身(先頭のバイト)で判定する。
 * 端末で長辺 1600px 程度に縮小・再エンコード済みのものを想定し、サーバーでは軽い検査だけをする。
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2048;

export type ImageCheck =
  | { ok: true; mime: 'image/jpeg' | 'image/webp'; width: number; height: number }
  | { ok: false; code: 'payload_too_large' | 'unsupported_media_type' | 'invalid_request' };

function u16be(b: Uint8Array, i: number) {
  return (b[i]! << 8) | b[i + 1]!;
}
function u16le(b: Uint8Array, i: number) {
  return b[i]! | (b[i + 1]! << 8);
}
function u24le(b: Uint8Array, i: number) {
  return b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = u16be(b, i + 2);
    // SOF0〜SOF15(DHT・JPG・DAC を除く)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  if (chunk === 'VP8 ' && b.length >= 30) {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X' && b.length >= 30) {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.byteLength === 0) return { ok: false, code: 'invalid_request' };
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, code: 'payload_too_large' };
  let mime: 'image/jpeg' | 'image/webp';
  let size: { width: number; height: number } | null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mime = 'image/jpeg';
    size = jpegSize(bytes);
  } else if (
    bytes.length >= 16 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    mime = 'image/webp';
    size = webpSize(bytes);
  } else {
    return { ok: false, code: 'unsupported_media_type' };
  }
  if (!size || size.width < 1 || size.height < 1) return { ok: false, code: 'invalid_request' };
  if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) return { ok: false, code: 'payload_too_large' };
  return { ok: true, mime, ...size };
}
