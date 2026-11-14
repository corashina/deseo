import { queryOptions } from '@tanstack/react-query';
import { AppError } from '@deseo/domain/result';
import { memoryKeys, signMemoryPhoto } from './queries';
// Signed links and decoded image bytes stay outside persistent browser storage.
export async function loadMemoryPhoto(path: string, signal: AbortSignal): Promise<Blob> {
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
