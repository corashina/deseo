import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@deseo/domain/database';

export type DeseoClient = SupabaseClient<Database>;
export type RpcName = keyof Database['public']['Functions'];
let client: DeseoClient | undefined;
export function getSupabase(): DeseoClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect Deseo.');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Set a valid Supabase URL.');
  client = createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}
