import { assertEquals } from '@std/assert';
import { safeEqual } from './secret.ts';

Deno.test('safeEqual: 同じ値だけ true', () => {
  assertEquals(safeEqual('abc', 'abc'), true);
  assertEquals(safeEqual('abc', 'abd'), false);
  assertEquals(safeEqual('abc', 'abcd'), false);
  assertEquals(safeEqual('', 'abc'), false);
  assertEquals(safeEqual('', ''), true);
});
