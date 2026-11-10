import { assertEquals } from '@std/assert';
import { MAX_IMAGE_BYTES, checkImage } from './image.ts';

/** 最小の JPEG(SOI + SOF0 だけ) */
function jpeg(w: number, h: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    h >> 8,
    h & 0xff,
    w >> 8,
    w & 0xff,
    0x03,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}
/** VP8X の WebP ヘッダ */
function webp(w: number, h: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  b.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  b.set(
    [...'VP8X'].map((c) => c.charCodeAt(0)),
    12,
  );
  const w1 = w - 1,
    h1 = h - 1;
  b.set([w1 & 0xff, (w1 >> 8) & 0xff, (w1 >> 16) & 0xff, h1 & 0xff, (h1 >> 8) & 0xff, (h1 >> 16) & 0xff], 24);
  return b;
}

Deno.test('JPEG and WebP are recognised by content and size', () => {
  assertEquals(checkImage(jpeg(1600, 1200)), { ok: true, mime: 'image/jpeg', width: 1600, height: 1200 });
  assertEquals(checkImage(webp(1200, 1600)), { ok: true, mime: 'image/webp', width: 1200, height: 1600 });
});

Deno.test('PNG, GIF, text and empty files are rejected', () => {
  assertEquals(checkImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).ok, false);
  assertEquals(checkImage(new TextEncoder().encode('GIF89a......')), { ok: false, code: 'unsupported_media_type' });
  assertEquals(checkImage(new TextEncoder().encode('<script>alert(1)</script>')), {
    ok: false,
    code: 'unsupported_media_type',
  });
  assertEquals(checkImage(new Uint8Array()), { ok: false, code: 'invalid_request' });
});

Deno.test('oversized dimensions and bytes are rejected', () => {
  assertEquals(checkImage(jpeg(4000, 3000)), { ok: false, code: 'payload_too_large' });
  assertEquals(checkImage(webp(2049, 100)), { ok: false, code: 'payload_too_large' });
  const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
  big.set(jpeg(10, 10));
  assertEquals(checkImage(big), { ok: false, code: 'payload_too_large' });
});

Deno.test('truncated headers are rejected', () => {
  assertEquals(checkImage(new Uint8Array([0xff, 0xd8, 0xff])), { ok: false, code: 'invalid_request' });
  assertEquals(checkImage(webp(10, 10).slice(0, 20)), { ok: false, code: 'invalid_request' });
});
