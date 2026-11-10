import { assertEquals } from '@std/assert';
import { corsHeaders, errorResponse, readJsonBody, requestIdOf, rpcError } from './http.ts';

const post = (body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request('http://localhost/x', { method: 'POST', body, headers });

Deno.test('errorResponse has no internal details and is not cacheable', async () => {
  const res = errorResponse('forbidden', 'req-12345678');
  assertEquals(res.status, 403);
  assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals(await res.json(), { error: { code: 'forbidden', request_id: 'req-12345678' } });
});

Deno.test('readJsonBody enforces content type, size and JSON', async () => {
  assertEquals(await readJsonBody(post('{"a":1}'), 100), { ok: true, value: { a: 1 } });
  assertEquals(await readJsonBody(post('{"a":1}', { 'content-type': 'text/plain' }), 100), {
    ok: false,
    code: 'unsupported_media_type',
  });
  assertEquals(await readJsonBody(post('x'.repeat(200)), 100), { ok: false, code: 'payload_too_large' });
  assertEquals(await readJsonBody(post('{bad'), 100), { ok: false, code: 'invalid_request' });
});

Deno.test('corsHeaders only reflects allowed origins', () => {
  const req = (origin: string) => new Request('http://localhost/x', { headers: { origin } });
  assertEquals(corsHeaders(req('https://evil.example'), ['https://app.example']), {});
  assertEquals(
    corsHeaders(req('https://app.example'), ['https://app.example'])['Access-Control-Allow-Origin'],
    'https://app.example',
  );
});

Deno.test('requestIdOf accepts only safe ids', () => {
  const r = (id: string) => new Request('http://localhost/x', { headers: { 'x-request-id': id } });
  assertEquals(requestIdOf(r('abcdEFGH-1234')), 'abcdEFGH-1234');
  assertEquals(requestIdOf(r('<script>')) === '<script>', false);
});

Deno.test('rpcError maps envelopes', () => {
  assertEquals(rpcError({ ok: true, data: null }), null);
  assertEquals(rpcError({ ok: false, error: 'forbidden' }), 'forbidden');
  assertEquals(rpcError({ ok: false, error: 'weird' }), 'internal');
  assertEquals(rpcError(null), 'internal');
});
