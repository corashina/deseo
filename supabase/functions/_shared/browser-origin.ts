const allowedHeaders = new Set(['authorization', 'apikey', 'content-type', 'x-client-info', 'x-supabase-api-version']);
function configuredOrigin(): string | null {
  const value = Deno.env.get('WEB_APP_ORIGIN');
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value ? value : null;
  } catch { return null; }
}
export function browserOriginHeaders(request: Request): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  const origin = configuredOrigin();
  if (origin && request.headers.get('origin') === origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', [...allowedHeaders].join(', '));
  }
  return headers;
}
export function browserPreflight(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const headers = browserOriginHeaders(request);
  if (origin !== null && origin !== configuredOrigin())
    return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  if (request.method !== 'OPTIONS') return null;
  const requested = (request.headers.get('access-control-request-headers') ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!origin || request.headers.get('access-control-request-method') !== 'POST' || requested.some(value => !allowedHeaders.has(value)))
    return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  return new Response(null, { status: 204, headers });
}
