import { authenticate, failed, isUuid, readBody, reply, rpc, type MemoryActor, type Outcome } from '../_shared/memory-http.ts';

interface MediaPath { bucket: string; path: string; expiresIn: number; photoId: string }
export async function handleMedia(request: Request,
  authorize: (request: Request) => Promise<Outcome<MemoryActor>> = authenticate): Promise<Response> {
  const body = await readBody(request);
  if (!body || !isUuid(body.photoId) || (body.variant !== undefined
    && (typeof body.variant !== 'string' || !['full', 'thumb'].includes(body.variant)))) return reply(failed('VALIDATION'));
  try {
    const auth = await authorize(request);
    if (!auth.ok) return reply(auth);
    const { caller, admin } = auth.data;
    const args = { p_photo_id: body.photoId, p_variant: body.variant ?? 'full' };
    const allowed = await rpc<MediaPath>(caller, 'get_memory_media', args);
    if (!allowed.ok) return reply(allowed);
    if (allowed.data.bucket !== 'memory-photos' || allowed.data.expiresIn !== 60) return reply(failed('FORBIDDEN'));
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const { data, error } = await admin.storage.from('memory-photos').createSignedUrl(allowed.data.path, 60);
    if (error || !data?.signedUrl) return reply(failed('RETRYABLE'));
    const current = await rpc<MediaPath>(caller, 'get_memory_media', args);
    if (!current.ok) return reply(current);
    if (current.data.path !== allowed.data.path) return reply(failed('FORBIDDEN'));
    return reply({ ok: true, data: { url: data.signedUrl, expiresAt } });
  } catch { return reply(failed('RETRYABLE')); }
}
