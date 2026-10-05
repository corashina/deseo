export function injectedKey(value: string | undefined, role: 'publishable'|'secret'): string | null {
  try {
    const parsed: unknown = JSON.parse(value ?? '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !('default' in parsed)) return null;
    const key = parsed.default;
    return typeof key === 'string' && key.startsWith(`sb_${role}_`) && key.length > `sb_${role}_`.length ? key : null;
  } catch { return null; }
}
export function runtimeKeys() {
  return { publishable: injectedKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), 'publishable'), secret: injectedKey(Deno.env.get('SUPABASE_SECRET_KEYS'), 'secret') };
}
