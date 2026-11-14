const allowedHeaders = new Set(['authorization', 'apikey', 'content-type', 'x-client-info', 'x-supabase-api-version']);
// WEB_APP_ORIGIN is a comma-separated list. Keep only exact http and https origins.
function parseOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const item of (value ?? '').split(',')) {
    const origin = item.trim();
    try {
      const url = new URL(origin);
      if (['http:', 'https:'].includes(url.protocol) && url.origin === origin) origins.add(origin);
    } catch { /* Ignore invalid entries. */ }
  }
  return origins;
}
const configuredOrigins = parseOrigins(Deno.env.get('WEB_APP_ORIGIN'));
export function browserOriginHeaders(request: Request): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  const origin = request.headers.get('origin');
  if (origin !== null && configuredOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', [...allowedHeaders].join(', '));
  }
  return headers;
}
// Native requests have no Origin. Reject every other origin that is not configured, including "null".
export function browserPreflight(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const headers = browserOriginHeaders(request);
  if (origin !== null && !configuredOrigins.has(origin))
    return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  if (request.method !== 'OPTIONS') return null;
  const requested = (request.headers.get('access-control-request-headers') ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!origin || request.headers.get('access-control-request-method') !== 'POST' || requested.some(value => !allowedHeaders.has(value)))
    return Response.json({ ok: false, error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  return new Response(null, { status: 204, headers });
}
