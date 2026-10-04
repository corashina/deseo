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
export async function handleFinalize(request: Request, deps = defaults): Promise<Response> {
  const body = await readBody(request);
  if (!body || !isUuid(body.memoryId) || typeof body.action !== 'string'
    || !['inspect', 'validate', 'publish'].includes(body.action)) return reply(failed('VALIDATION'));
  if (body.action === 'validate' && !isUuid(body.photoId)) return reply(failed('VALIDATION'));
  if (body.action === 'publish' && !isUuid(body.commandId)) return reply(failed('VALIDATION'));
  try {
    const auth = await deps.authenticate(request);
    if (!auth.ok) return reply(auth);
    const actor = auth.data;
    const scope = { p_memory_id: body.memoryId, p_actor_id: actor.actorId, p_session_id: actor.sessionId };
    const reservation = await rpc<Reservation>(actor.admin, 'verify_memory_reservation', scope);
    if (!reservation.ok) return reply(reservation);
    if (body.action === 'publish') return reply(await rpc(actor.admin, 'publish_memory', { ...scope, p_command_id: body.commandId }));
    if (body.action === 'inspect') {
      const photos = [];
      for (const photo of reservation.data.photos) {
        const found = await actor.admin.storage.from('memory-photos').list(
          `${reservation.data.pairId}/${reservation.data.id}/${photo.id}`, { limit: 3 });
        if (found.error) return reply(failed('RETRYABLE'));
        photos.push({ id: photo.id, full: found.data.some(file => file.name === 'full.jpg'),
          thumb: found.data.some(file => file.name === 'thumb.jpg'), validated: photo.validated });
      }
      // Listing can outlive membership. Do not return retry state after revocation.
      const current = await rpc(actor.admin, 'verify_memory_reservation', scope);
      return reply(current.ok ? { ok: true, data: { memory: reservation.data, photos } } : current);
    }
    const photo = reservation.data.photos.find(item => item.id === body.photoId);
    if (!photo) return reply(failed('FORBIDDEN'));
    if (photo.validated) return reply({ ok: true, data: photo });
    for (const variant of ['full', 'thumb'] as const) {
      const path = variant === 'full' ? photo.fullPath : photo.thumbPath;
      const expectedPath = `${reservation.data.pairId}/${reservation.data.id}/${photo.id}/${variant}.jpg`;
      if (path !== expectedPath) return reply(failed('FORBIDDEN'));
      const { data, error } = await actor.admin.storage.from('memory-photos').download(path);
      if (error || !data) return reply(failed('RETRYABLE'));
      const expected = variant === 'full'
        ? { bytes: photo.fullBytes, width: photo.width, height: photo.height }
        : { bytes: photo.thumbBytes, width: photo.thumbWidth, height: photo.thumbHeight };
      if (data.size !== expected.bytes || data.size > 5 * 1024 * 1024) return reply(failed('VALIDATION'));
      try { deps.validate(new Uint8Array(await data.arrayBuffer()), expected, variant === 'full' ? 2560 : 512); }
      catch { return reply(failed('VALIDATION')); }
    }
    return reply(await rpc(actor.admin, 'validate_memory_photo', { ...scope, p_photo_id: photo.id, p_evidence: {
      fullBytes: photo.fullBytes, thumbBytes: photo.thumbBytes, width: photo.width, height: photo.height,
      thumbWidth: photo.thumbWidth, thumbHeight: photo.thumbHeight,
    } }));
  } catch { return reply(failed('RETRYABLE')); }
}
