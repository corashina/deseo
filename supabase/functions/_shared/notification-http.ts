import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { failed, isUuid, reply } from './memory-http.ts';

export type NotificationRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
export interface NotificationLease { id: string; leaseId: string; attempt: number; expiresAt: string }
export interface PushJob extends NotificationLease { notificationId: string; token: string }
export interface ReceiptJob extends NotificationLease { ticket: string }
export type PushOutcome = { status: 'submitted'; ticket: string } | { status: 'retry' | 'failed'; code: string }
  | { status: 'device_not_registered' };
export type ReceiptOutcome = { status: 'accepted' | 'device_not_registered' }
  | { status: 'pending' | 'failed'; code: string };
type ExpoResponse = { kind: 'ok'; data: unknown } | { kind: 'http'; status: number }
  | { kind: 'invalid' | 'uncertain' };

export const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512;
function isLease(value: unknown): value is NotificationLease & Record<string, unknown> {
  return record(value) && isUuid(value.id) && isUuid(value.leaseId) && Number.isInteger(value.attempt)
    && Number(value.attempt) > 0 && typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt));
}
export const isPushJob = (value: unknown): value is PushJob => isLease(value) && isUuid(value.notificationId) && text(value.token);
export const isReceiptJob = (value: unknown): value is ReceiptJob => isLease(value) && text(value.ticket);
export async function callRpc(rpc: NotificationRpc, name: string, args?: Record<string, unknown>): Promise<unknown> {
  const result = await rpc(name, args);
  if (result.error) throw new Error('Notification transaction failed');
  return result.data;
}
export async function complete(rpc: NotificationRpc, name: string, job: NotificationLease,
  outcome: PushOutcome | ReceiptOutcome): Promise<void> {
  const result = await callRpc(rpc, name, { p_id: job.id, p_lease_id: job.leaseId, p_outcome: outcome });
  if (!record(result) || result.ok !== true) throw new Error('Notification lease completion failed');
}

export async function workerRpc(request: Request): Promise<NotificationRpc | Response> {
  if (request.method !== 'POST') return reply(failed('VALIDATION'));
  const secret = Deno.env.get('NOTIFICATION_WORKER_SECRET');
  if (!secret || secret.length < 32) return reply(failed('RETRYABLE'));
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(failed('UNAUTHENTICATED'));
  const values = await Promise.all([secret, authorization.slice(7)].map(value =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
  const a = new Uint8Array(values[0]); const b = new Uint8Array(values[1]);
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) mismatch |= a[index] ^ b[index];
  if (mismatch) return reply(failed('UNAUTHENTICATED'));
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply(failed('RETRYABLE'));
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }) },
  });
  return (name, args) => admin.rpc(name, args);
}

// Keep the timeout active while reading the body, including chunked responses.
export async function expoRequest(endpoint: 'send' | 'getReceipts', body: unknown,
  fetcher: typeof fetch = fetch, timeoutMs = 10_000): Promise<ExpoResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const response = await fetcher(`https://exp.host/--/api/v2/push/${endpoint}`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) { await response.body?.cancel(); return { kind: 'http', status: response.status }; }
    if (!response.body || Number(response.headers.get('content-length')) > 65_536) {
      await response.body?.cancel(); return { kind: 'invalid' };
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 65_536) { await reader.cancel(); return { kind: 'invalid' }; }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return { kind: 'invalid' }; }
    if (!record(parsed) || !('data' in parsed) || ('errors' in parsed && (!Array.isArray(parsed.errors) || parsed.errors.length))) {
      return { kind: 'invalid' };
    }
    return { kind: 'ok', data: parsed.data };
  } catch { return { kind: 'uncertain' }; }
  finally { clearTimeout(timer); reader?.releaseLock(); }
}
export function providerFailure(response: Exclude<ExpoResponse, { kind: 'ok' }>): { transient: boolean; code: string } {
  if (response.kind === 'http') return { transient: response.status === 429 || response.status >= 500,
    code: `PROVIDER_HTTP_${response.status}` };
  return { transient: true, code: response.kind === 'invalid' ? 'INVALID_PROVIDER_RESPONSE' : 'PROVIDER_UNCERTAIN' };
}
export function providerError(data: Record<string, unknown>): string {
  const code = record(data.details) ? data.details.error : undefined;
  return typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(code) ? code : 'PROVIDER_ERROR';
}
