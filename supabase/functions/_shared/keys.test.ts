// Importance 100: privileged clients require the documented injected key maps.
import { strict as assert } from 'node:assert';
import { injectedKey } from './keys.ts';
Deno.test('key maps require a valid default key with the correct role', () => {
  assert.equal(injectedKey('{"default":"sb_publishable_fixture"}', 'publishable'), 'sb_publishable_fixture');
  assert.equal(injectedKey('{"default":"sb_secret_fixture"}', 'secret'), 'sb_secret_fixture');
  for (const value of [undefined, '', 'broken', '{}', '[]', '{"default":2}', '{"default":"sb_secret_fixture"}']) assert.equal(injectedKey(value, 'publishable'), null);
});
