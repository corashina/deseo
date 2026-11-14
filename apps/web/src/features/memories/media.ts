import { AppError } from '@deseo/domain/result';
import { captureQueryScope } from '../../lib/query-client';
import { signMemoryPhoto } from './queries';
// Signed links and decoded image bytes stay outside persistent browser storage.
export async function loadMemoryPhoto(path: string, signal: AbortSignal): Promise<Blob> {
  const scope = captureQueryScope();
  const combined = AbortSignal.any([signal, scope.signal]);
  for (let attempt = 0; attempt < 2; attempt++) {
    combined.throwIfAborted();
    const url = await signMemoryPhoto(path);
    scope.assertCurrent(); combined.throwIfAborted();
    const response = await fetch(url, { cache: 'no-store', signal: combined, credentials: 'omit' });
    scope.assertCurrent(); combined.throwIfAborted();
    if (response.ok) {
      const blob = await response.blob();
      scope.assertCurrent(); combined.throwIfAborted();
      if (blob.type !== 'image/jpeg' || blob.size > 5 * 1024 * 1024) throw new AppError({ code: 'VALIDATION' });
      return blob;
    }
    if (![400, 401, 403].includes(response.status)) throw new AppError({ code: 'RETRYABLE' });
  }
  throw new AppError({ code: 'FORBIDDEN', message: 'This photo is unavailable. Open the memory again.' });
}
