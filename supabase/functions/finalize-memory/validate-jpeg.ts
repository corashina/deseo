import ExifReader from 'npm:exifreader@4.46.0';
import jpeg from 'npm:jpeg-js@0.4.4';

const codingMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc4, 0xdb, 0xdd, 0xda]);
function reject(): never { throw new Error('Invalid prepared JPEG'); }

/** Check marker envelopes only. ExifReader parses metadata; jpeg-js decodes pixels below.
 * ExifReader stops at the first scan, so this allowlist also checks between later scans.
 */
function checkEnvelopes(bytes: Uint8Array): void {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) reject();
  let position = 2;
  let scanning = false;
  let sawScan = false;
  while (position < bytes.length) {
    if (scanning) {
      while (position < bytes.length && bytes[position] !== 0xff) position++;
    }
    if (bytes[position++] !== 0xff) reject();
    while (bytes[position] === 0xff) position++;
    const marker = bytes[position++];
    if (scanning && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    scanning = false;
    if (marker === 0xd9) {
      if (!sawScan || position !== bytes.length) reject();
      return;
    }
    if (!codingMarkers.has(marker) && marker !== 0xe0 && marker !== 0xee) reject();
    if (position + 2 > bytes.length) reject();
    const length = (bytes[position] << 8) | bytes[position + 1];
    const payload = position + 2;
    if (length < 2 || position + length > bytes.length) reject();
    if (marker === 0xe0 && (length !== 16 || bytes[payload] !== 74 || bytes[payload + 1] !== 70
      || bytes[payload + 2] !== 73 || bytes[payload + 3] !== 70 || bytes[payload + 4] !== 0
      || bytes[payload + 12] !== 0 || bytes[payload + 13] !== 0)) reject();
    if (marker === 0xee && (length !== 14 || bytes[payload] !== 65 || bytes[payload + 1] !== 100
      || bytes[payload + 2] !== 111 || bytes[payload + 3] !== 98 || bytes[payload + 4] !== 101)) reject();
    position += length;
    if (marker === 0xda) { scanning = true; sawScan = true; }
  }
  reject();
}

export function validateJpeg(bytes: Uint8Array, expected: { bytes: number; width: number; height: number }, longestSide: number): void {
  if (bytes.length < 4 || bytes.length > 5 * 1024 * 1024 || bytes.length !== expected.bytes) reject();
  checkEnvelopes(bytes);
  const metadata = ExifReader.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { expanded: true });
  if (metadata.file?.FileType?.value !== 'jpeg' || metadata.exif || metadata.xmp || metadata.iptc
    || metadata.icc || metadata.gps || metadata.Thumbnail || metadata.photoshop || metadata.makerNotes) reject();
  const width = metadata.file?.['Image Width']?.value;
  const height = metadata.file?.['Image Height']?.value;
  if (!width || !height || width !== expected.width || height !== expected.height
    || Math.max(width, height) > longestSide) reject();
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: false, tolerantDecoding: false,
    maxResolutionInMP: longestSide * longestSide / 1_000_000, maxMemoryUsageInMB: 160 });
  if (decoded.width !== width || decoded.height !== height || decoded.data.length !== width * height * 3) reject();
}
