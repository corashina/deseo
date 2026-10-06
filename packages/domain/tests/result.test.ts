// Importance 100: canceled requests must return a safe retry result without throwing.
import { errorResult, toAppError } from '../src/result';
test('numeric DOM abort codes become retryable errors', () => {
  expect(toAppError(new DOMException('Canceled', 'AbortError')).code).toBe('RETRYABLE');
  expect(errorResult({ code: 20 })).toMatchObject({ ok: false, error: { code: 'RETRYABLE' } });
});
