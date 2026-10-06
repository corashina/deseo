import { browserOriginHeaders, browserPreflight } from '../_shared/browser-origin.ts';
import { runtimeKeys } from '../_shared/keys.ts';
import { createClient } from '@supabase/supabase-js';

type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION' | 'RATE_LIMITED' | 'RETRYABLE';
const fail = (code: ErrorCode, status = 400) => Response.json({ ok: false, error: { code } }, { status });
const success = (data: unknown) => Response.json({ ok: true, data });
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

async function handle(request: Request) {
  // Browser origin checks run before this authenticated handler.
  if (request.method !== 'POST') return fail('VALIDATION', 405);
  const bearer = request.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ')) return fail('UNAUTHENTICATED', 401);
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return fail('VALIDATION');

  let body: { action: 'end_pair'; code?: string };
  try {
    const text = await request.text();
    if (text.length > 1024) return fail('VALIDATION');
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || parsed.action !== 'end_pair'
      || (parsed.code !== undefined && (typeof parsed.code !== 'string' || !/^\d{6}$/.test(parsed.code)))) {
      return fail('VALIDATION');
    }
    body = parsed;
  } catch {
    return fail('VALIDATION');
  }
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const { publishable: publishableKey, secret: secretKey } = runtimeKeys();
    if (!url || !publishableKey || !secretKey) return fail('RETRYABLE', 503);
    const token = bearer.slice(7);
    const caller = createClient(url, publishableKey, { ...options, global: { headers: { Authorization: bearer } } });
    const [{ data: userData, error: userError }, { data: claimsData, error: claimsError }, context] = await Promise.all([
      caller.auth.getUser(token), caller.auth.getClaims(token), caller.rpc('get_session_context'),
    ]);
    if (userError || claimsError || !userData.user || !claimsData?.claims.session_id || context.error || !context.data?.ok) {
      return fail('UNAUTHENTICATED', 401);
    }
    if (!context.data.data.account || context.data.data.account.status !== 'active') return fail('FORBIDDEN', 403);
    const user = userData.user;
    if (!user.email || !user.email_confirmed_at) return fail('FORBIDDEN', 403);
    const otpClient = createClient(url, publishableKey, options);
    if (body.code === undefined) {
      const { error } = await otpClient.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
      if (error) return fail(error.status === 429 ? 'RATE_LIMITED' : 'RETRYABLE', error.status === 429 ? 429 : 503);
      return success({ retryAt: new Date(Date.now() + 60_000).toISOString() });
    }

    const verified = await otpClient.auth.verifyOtp({ email: user.email, token: body.code, type: 'email' });
    if (verified.error || !verified.data.session || verified.data.user?.id !== user.id) {
      return fail(verified.error?.status === 429 ? 'RATE_LIMITED' : 'VALIDATION');
    }
    const admin = createClient(url, secretKey, options);
    // Email verification starts an unused session. Revoke it before issuing the proof.
    const { error: revokeError } = await admin.auth.admin.signOut(verified.data.session.access_token, 'local');
    if (revokeError) return fail('RETRYABLE', 503);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const proof = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proof)));
    const proofHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const { data, error } = await admin.rpc('issue_verification_proof', {
      p_user_id: user.id, p_session_id: claimsData.claims.session_id, p_action: body.action, p_proof_hash: proofHash,
    });
    if (error) return fail('RETRYABLE', 503);
    if (!data?.ok) return fail('UNAUTHENTICATED', 401);
    return success({ proof, expiresAt: data.data.expiresAt });
  } catch {
    return fail('RETRYABLE', 503);
  }
}
Deno.serve(async (request: Request) => {
  const preflight = browserPreflight(request);
  if (preflight) return preflight;
  const response = await handle(request);
  const headers = browserOriginHeaders(request);
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
