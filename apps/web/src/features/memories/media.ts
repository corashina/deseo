import { queryOptions } from '@tanstack/react-query';
import { AppError } from '@deseo/domain/result';
import { memoryKeys, signMemoryPhoto } from './queries';
// At most four photos download at once, so a long feed does not crowd out the rest of the page.
const limit = 4;
let active = 0;
const waiting: (() => void)[] = [];
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  // A finished download hands its place to the next one in line.
  if (active < limit) active++;
  else await new Promise<void>(resolve => waiting.push(resolve));
  try { return await work(); } finally {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
}
// Signed links and decoded image bytes stay outside persistent browser storage.
export function loadMemoryPhoto(path: string, signal: AbortSignal): Promise<Blob> {
  return inTurn(() => download(path, signal));
}
async function download(path: string, signal: AbortSignal): Promise<Blob> {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    const url = await signMemoryPhoto(path);
    const response = await fetch(url, { cache: 'no-store', signal, credentials: 'omit' });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.type !== 'image/jpeg' || blob.size > 5 * 1024 * 1024) throw new AppError({ code: 'VALIDATION' });
      return blob;
    }
    if (![400, 401, 403].includes(response.status)) throw new AppError({ code: 'RETRYABLE' });
  }
  throw new AppError({ code: 'FORBIDDEN', message: 'This photo is unavailable. Open the memory again.' });
}
// The query cache holds the blob only while a page shows the photo. Sign-out and pair change clear it.
export function memoryPhotoQuery(accountId: string, pairId: string, path: string) {
  return queryOptions({ queryKey: memoryKeys.photo(accountId, pairId, path), queryFn: ({ signal }) => loadMemoryPhoto(path, signal),
    staleTime: Infinity, gcTime: 0, retry: false });
}
