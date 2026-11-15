import { browserPreflight } from '../_shared/browser-origin.ts';
import { authenticate, failed, isUuid, readBody, reply, rpc, type MemoryActor, type Outcome } from '../_shared/memory-http.ts';
import { validateJpeg } from './validate-jpeg.ts';

interface Photo {
  id: string; fullPath: string; thumbPath: string; fullBytes: number; thumbBytes: number;
  width: number; height: number; thumbWidth: number; thumbHeight: number; validated: boolean;
}
interface Reservation { id: string; pairId: string; state: 'pending' | 'published' | 'deleting'; photos: Photo[] }
export interface FinalizeDependencies {
  authenticate(request: Request): Promise<Outcome<MemoryActor>>;
  validate(bytes: Uint8Array, expected: { bytes: number; width: number; height: number }, longestSide: number): void;
}
const defaults: FinalizeDependencies = { authenticate, validate: validateJpeg };
// Check the bytes of each uploaded photo, then publish the memory. A retry skips photos already validated.
export async function handleFinalize(request: Request, deps = defaults): Promise<Response> {
  const preflight = browserPreflight(request);
  if (preflight) return preflight;
  const respond = (result: Outcome<unknown>) => reply(result, request);
  const body = await readBody(request);
  if (!body || !isUuid(body.memoryId) || !isUuid(body.commandId)) return respond(failed('VALIDATION'));
  try {
    const auth = await deps.authenticate(request);
    if (!auth.ok) return respond(auth);
    const actor = auth.data;
    const scope = { p_memory_id: body.memoryId, p_actor_id: actor.actorId, p_session_id: actor.sessionId };
    const reservation = await rpc<Reservation>(actor.admin, 'verify_memory_reservation', scope);
    if (!reservation.ok) return respond(reservation);
    for (const photo of reservation.data.photos) {
      if (photo.validated) continue;
      for (const variant of ['full', 'thumb'] as const) {
        const path = variant === 'full' ? photo.fullPath : photo.thumbPath;
        const expectedPath = `${reservation.data.pairId}/${reservation.data.id}/${photo.id}/${variant}.jpg`;
        if (path !== expectedPath) return respond(failed('FORBIDDEN'));
        const { data, error } = await actor.admin.storage.from('memory-photos').download(path);
        // A missing file is an unfinished upload. The client uploads it again and retries.
        if (error || !data) return respond(failed('RETRYABLE'));
        const expected = variant === 'full'
          ? { bytes: photo.fullBytes, width: photo.width, height: photo.height }
          : { bytes: photo.thumbBytes, width: photo.thumbWidth, height: photo.thumbHeight };
        if (data.size !== expected.bytes || data.size > 5 * 1024 * 1024) return respond(failed('VALIDATION'));
        try { deps.validate(new Uint8Array(await data.arrayBuffer()), expected, variant === 'full' ? 2560 : 512); }
        catch { return respond(failed('VALIDATION')); }
      }
      const validated = await rpc(actor.admin, 'validate_memory_photo', { ...scope, p_photo_id: photo.id, p_evidence: {
        fullBytes: photo.fullBytes, thumbBytes: photo.thumbBytes, width: photo.width, height: photo.height,
        thumbWidth: photo.thumbWidth, thumbHeight: photo.thumbHeight,
      } });
      if (!validated.ok) return respond(validated);
    }
    return respond(await rpc(actor.admin, 'publish_memory', { ...scope, p_command_id: body.commandId }));
  } catch { return respond(failed('RETRYABLE')); }
}
