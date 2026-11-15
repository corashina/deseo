import { browserOriginHeaders } from './browser-origin.ts';
import { runtimeKeys } from './keys.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT' | 'QUOTA_EXCEEDED' | 'RETRYABLE';
export type Outcome<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; field?: string } };
export interface MemoryActor { admin: SupabaseClient; actorId: string; sessionId: string }
interface IdentityCheck {
  actorId?: string; sessionId?: unknown; subject?: string;
  userError: { status?: number } | null; claimsError: { status?: number } | null;
  contextError: unknown;
  context: Outcome<{ userId: string; account: { status: string } | null }> | null;
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const failed = (code: ErrorCode): Outcome<never> => ({ ok: false, error: { code } });
export function reply(result: Outcome<unknown>, request?: Request): Response {
  const status = result.ok ? 200 : ({ UNAUTHENTICATED: 401, FORBIDDEN: 403, VALIDATION: 400,
    CONFLICT: 409, QUOTA_EXCEEDED: 409, RETRYABLE: 503 })[result.error.code];
  return Response.json(result, { status, headers: request ? browserOriginHeaders(request) : { 'Cache-Control': 'no-store' } });
}
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.method !== 'POST' || Number(request.headers.get('content-length')) > 4096 || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 4096) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
export function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = runtimeKeys().secret;
  return url && key ? createClient(url, key, options) : null;
}
export function resolveIdentity(check: IdentityCheck): Outcome<{ actorId: string; sessionId: string }> {
  for (const error of [check.userError, check.claimsError]) {
    if (error) return failed(error.status === 401 ? 'UNAUTHENTICATED' : error.status === 403 ? 'FORBIDDEN' : 'RETRYABLE');
  }
  if (check.contextError || !check.context || typeof check.context.ok !== 'boolean') return failed('RETRYABLE');
  if (!check.context.ok) return check.context;
  if (!check.actorId || !isUuid(check.sessionId) || check.subject !== check.actorId
    || check.context.data.userId !== check.actorId) return failed('UNAUTHENTICATED');
  if (check.context.data.account?.status !== 'active') return failed('FORBIDDEN');
  return { ok: true, data: { actorId: check.actorId, sessionId: check.sessionId } };
}
export async function authenticate(request: Request): Promise<Outcome<MemoryActor>> {
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return failed('UNAUTHENTICATED');
  const url = Deno.env.get('SUPABASE_URL');
  const key = runtimeKeys().publishable;
  const admin = serviceClient();
  if (!url || !key || !admin) return failed('RETRYABLE');
  const caller = createClient(url, key, { ...options, global: { headers: { Authorization: bearer } } });
  const token = bearer.slice(7);
  const [user, claims, context] = await Promise.all([
    caller.auth.getUser(token), caller.auth.getClaims(token), caller.rpc('get_session_context'),
  ]);
  const identity = resolveIdentity({ actorId: user.data.user?.id, sessionId: claims.data?.claims.session_id,
    subject: claims.data?.claims.sub, userError: user.error, claimsError: claims.error,
    contextError: context.error, context: context.data });
  return identity.ok ? { ok: true, data: { admin, ...identity.data } } : identity;
}
export async function rpc<T>(client: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<Outcome<T>> {
  const { data, error } = await client.rpc(name, args);
  if (error || typeof data?.ok !== 'boolean') return failed('RETRYABLE');
  return data as Outcome<T>;
}
