// Importance 100: prevent invalid bytes, hidden metadata, and forged image declarations.
import { strict as assert } from 'node:assert';
import jpeg from 'npm:jpeg-js@0.4.4';
import { validateJpeg } from './validate-jpeg.ts';
import fixture from './progressive-fixture.json' with { type: 'json' };

const clean = new Uint8Array(jpeg.encode({ width: 2, height: 2,
  data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]) }, 80).data);
const expected = (bytes: Uint8Array) => ({ bytes: bytes.length, width: 2, height: 2 });
function insert(source: Uint8Array, position: number, segment: number[]): Uint8Array {
  return new Uint8Array([...source.slice(0, position), ...segment, ...source.slice(position)]);
}
Deno.test('accepts decoded JPEG with accurate dimensions and no private metadata', () => {
  validateJpeg(clean, expected(clean), 2560);
});
Deno.test('rejects forged types, truncated scans, and trailing payload', () => {
  for (const bytes of [new Uint8Array([137, 80, 78, 71]), clean.slice(0, clean.length - 8),
    new Uint8Array([...clean, 1, 2, 3]), new Uint8Array([255, 216, 255, 217])]) {
    assert.throws(() => validateJpeg(bytes, expected(bytes), 2560));
  }
});
Deno.test('rejects false size, dimensions, and thumbnail limits', () => {
  assert.throws(() => validateJpeg(clean, { ...expected(clean), bytes: 1 }, 2560));
  assert.throws(() => validateJpeg(clean, { ...expected(clean), width: 3 }, 2560));
  assert.throws(() => validateJpeg(clean, expected(clean), 1));
  const oversized = new Uint8Array(5242881);
  assert.throws(() => validateJpeg(oversized, expected(oversized), 2560));
});
Deno.test('rejects EXIF, XMP, comments, and unknown APP metadata before and after image scans', () => {
  for (const marker of [225, 226, 237, 239, 254]) {
    const segment = [255, marker, 0, 10, 71, 80, 83, 58, 49, 50, 51, 52];
    for (const position of [2, clean.length - 2]) {
      const bytes = insert(clean, position, segment);
      assert.throws(() => validateJpeg(bytes, expected(bytes), 2560));
    }
  }
});
Deno.test('rejects extra JFIF payload and invalid segment length', () => {
  const extra = insert(clean, 2, [255, 224, 0, 8, 74, 70, 73, 70, 0, 0]);
  const broken = insert(clean, 2, [255, 219, 255, 255]);
  assert.throws(() => validateJpeg(extra, expected(extra), 2560));
  assert.throws(() => validateJpeg(broken, expected(broken), 2560));
});
Deno.test('accepts progressive scans and rejects metadata between later scans', () => {
  const bytes = Uint8Array.from(atob(fixture.base64), character => character.charCodeAt(0));
  const dimensions = { bytes: bytes.length, width: 16, height: 16 };
  validateJpeg(bytes, dimensions, 2560);
  const scans: number[] = [];
  for (let index = 0; index < bytes.length - 1; index++) {
    if (bytes[index] === 255 && bytes[index + 1] === 218) scans.push(index);
  }
  assert.ok(scans.length > 1);
  const withMetadata = insert(bytes, scans[1], [255, 225, 0, 6, 71, 80, 83, 0]);
  assert.throws(() => validateJpeg(withMetadata, { ...dimensions, bytes: withMetadata.length }, 2560));
});
