import { browserPreflight } from '../_shared/browser-origin.ts';
import { authenticate, failed, isUuid, readBody, reply, rpc, type MemoryActor, type Outcome } from '../_shared/memory-http.ts';

interface MediaPath { bucket: string; path: string; expiresIn: number; photoId: string }
export async function handleMedia(request: Request,
  authorize: (request: Request) => Promise<Outcome<MemoryActor>> = authenticate): Promise<Response> {
  const preflight = browserPreflight(request);
  if (preflight) return preflight;
  const respond = (result: Outcome<unknown>) => reply(result, request);
  const body = await readBody(request);
  if (!body || !isUuid(body.photoId) || (body.variant !== undefined
    && (typeof body.variant !== 'string' || !['full', 'thumb'].includes(body.variant)))) return respond(failed('VALIDATION'));
  try {
    const auth = await authorize(request);
    if (!auth.ok) return respond(auth);
    const { caller, admin } = auth.data;
    const args = { p_photo_id: body.photoId, p_variant: body.variant ?? 'full' };
    const allowed = await rpc<MediaPath>(caller, 'get_memory_media', args);
    if (!allowed.ok) return respond(allowed);
    if (allowed.data.bucket !== 'memory-photos' || allowed.data.expiresIn !== 60) return respond(failed('FORBIDDEN'));
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const { data, error } = await admin.storage.from('memory-photos').createSignedUrl(allowed.data.path, 60);
    if (error || !data?.signedUrl) return respond(failed('RETRYABLE'));
    const current = await rpc<MediaPath>(caller, 'get_memory_media', args);
    if (!current.ok) return respond(current);
    if (current.data.path !== allowed.data.path) return respond(failed('FORBIDDEN'));
    const publicBase = Deno.env.get('PUBLIC_SUPABASE_URL');
    if (!publicBase) return respond(failed('RETRYABLE'));
    const publicUrl = new URL(publicBase);
    if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password
      || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) return respond(failed('RETRYABLE'));
    const signed = new URL(data.signedUrl);
    if (!signed.pathname.startsWith('/storage/v1/object/sign/memory-photos/')) return respond(failed('RETRYABLE'));
    const url = new URL(signed.pathname + signed.search, publicUrl).toString();
    return respond({ ok: true, data: { url, expiresAt } });
  } catch { return respond(failed('RETRYABLE')); }
}
