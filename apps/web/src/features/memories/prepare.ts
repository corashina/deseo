import type { MemoryInput } from '@deseo/domain/memories';
export type PreparedBrowserPhoto = { id: string; full: Blob; thumb: Blob; width: number; height: number; thumbWidth: number; thumbHeight: number };
export type MemoryReservationInput = MemoryInput & { id: string; pairId: string; photos: { id: string; fullBytes: number; thumbBytes: number; width: number; height: number; thumbWidth: number; thumbHeight: number }[] };
const maxBytes = 5 * 1024 * 1024;
// Only inspect output from the browser canvas encoder. Decoding remains a browser operation.
async function stripCanvasMetadata(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9)
    throw new Error('We could not prepare this photo.');
  const parts: BlobPart[] = [bytes.slice(0, 2)];
  let position = 2;
  while (position < bytes.length - 2) {
    if (bytes[position] !== 0xff) throw new Error('We could not prepare this photo.');
    const marker = bytes[position + 1];
    const length = (bytes[position + 2] << 8) | bytes[position + 3];
    const end = position + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error('We could not prepare this photo.');
    if (marker === 0xda) {
      parts.push(bytes.slice(position));
      return new Blob(parts, { type: 'image/jpeg' });
    }
    if (!(marker >= 0xe1 && marker <= 0xef && marker !== 0xee) && marker !== 0xfe)
      parts.push(bytes.slice(position, end));
    position = end;
  }
  throw new Error('We could not prepare this photo.');
}
async function encode(image: ImageBitmap, longest: number): Promise<{ blob: Blob; width: number; height: number }> {
  const ratio = Math.min(1, longest / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!context) throw new Error('This browser cannot prepare photos.');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const encoded = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  canvas.width = 0; canvas.height = 0;
  if (!encoded) throw new Error('We could not prepare this photo.');
  const blob = await stripCanvasMetadata(encoded);
  if (blob.size > maxBytes) throw new Error('This prepared photo exceeds 5 MiB. Choose a smaller photo.');
  return { blob, width, height };
}
export async function preparePhoto(file: File): Promise<PreparedBrowserPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (!file.size || file.size > 30 * 1024 * 1024) throw new Error('Choose a photo smaller than 30 MiB.');
  let image: ImageBitmap;
  try { image = await createImageBitmap(file); } catch { throw new Error('We could not read this photo. Choose another photo.'); }
  try {
    if (image.width * image.height > 100_000_000) throw new Error('This photo is too large. Choose a smaller photo.');
    const full = await encode(image, 2560);
    const thumb = await encode(image, 512);
    return { id: crypto.randomUUID(), full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, thumbWidth: thumb.width, thumbHeight: thumb.height };
  } finally { image.close(); }
}
// Each reservation gets new memory and photo IDs. The server keeps the IDs of an earlier reservation.
export function reservationInput(pairId: string, input: MemoryInput, photos: PreparedBrowserPhoto[]): MemoryReservationInput {
  return { ...input, id: crypto.randomUUID(), pairId, photos: photos.map(photo => ({ id: crypto.randomUUID(), fullBytes: photo.full.size, thumbBytes: photo.thumb.size,
    width: photo.width, height: photo.height, thumbWidth: photo.thumbWidth, thumbHeight: photo.thumbHeight })) };
}
