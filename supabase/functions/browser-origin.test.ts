// Importance 100: exact browser origin gates private media and memory writes.
import { strict as assert } from 'node:assert';
import { browserOriginHeaders, browserPreflight } from './_shared/browser-origin.ts';
import { handleMedia } from './get-memory-media/handler.ts';
const origin = 'http://127.0.0.1:4174';
Deno.test('browser origins and preflight use one exact configured origin', () => {
  Deno.env.set('WEB_APP_ORIGIN', origin);
  const request = (value?: string, method = 'POST', headers = {}) => new Request('https://api.example.test', {
    method, headers: { ...(value === undefined ? {} : { Origin: value }), ...headers },
  });
  assert.equal(browserOriginHeaders(request(origin)).get('Access-Control-Allow-Origin'), origin);
  assert.equal(browserPreflight(request(undefined)), null);
  for (const value of ['null', 'https://unknown.example.test', origin + '/', 'http://localhost:4174']) {
    assert.equal(browserOriginHeaders(request(value)).has('Access-Control-Allow-Origin'), false);
    assert.equal(browserPreflight(request(value))?.status, 403);
  }
  const allowed = browserPreflight(request(origin, 'OPTIONS', { 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info' }))!;
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(allowed.headers.get('Cache-Control'), 'no-store');
  assert.equal(browserPreflight(request(origin, 'OPTIONS', { 'Access-Control-Request-Method': 'DELETE' }))?.status, 403);
  assert.equal(browserPreflight(request(origin, 'OPTIONS', { 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'x-unknown' }))?.status, 403);
  Deno.env.delete('WEB_APP_ORIGIN');
  assert.equal(browserPreflight(request(origin))?.status, 403);
  assert.equal(browserPreflight(request(undefined)), null);
});
Deno.test('memory media error responses include exact CORS and no-store', async () => {
  Deno.env.set('WEB_APP_ORIGIN', origin);
  const response = await handleMedia(new Request('https://api.example.test', { method: 'POST',
    headers: { Origin: origin }, body: '{}' }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  Deno.env.delete('WEB_APP_ORIGIN');
});
