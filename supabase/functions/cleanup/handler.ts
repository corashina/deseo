import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { failed, reply, rpc, serviceClient } from '../_shared/memory-http.ts';

interface CleanupJob { id: string; memoryId: string; bucket: string; paths: string[]; leaseToken: string; attempt: number }
export async function runCleanup(admin: SupabaseClient): Promise<{ completed: number; retried: number }> {
  // Two memories per invocation bound object operations and avoid lease expiry mid-batch.
  const claimed = await rpc<CleanupJob[]>(admin, 'claim_memory_cleanup', { p_limit: 2 });
  if (!claimed.ok) throw new Error('Cleanup claim failed');
  let completed = 0;
  let retried = 0;
  let completionFailed = false;
  for (const job of claimed.data) {
    let code: string | null = null;
    if (job.bucket !== 'memory-photos' || job.paths.length > 10
      || job.paths.some(path => !path.includes(`/${job.memoryId}/`) || !/\/(full|thumb)\.jpg$/.test(path))) {
      code = 'INVALID_JOB';
    } else {
      try {
        const removed = await admin.storage.from(job.bucket).remove(job.paths);
        if (removed.error) code = 'STORAGE_REMOVE_FAILED';
      } catch { code = 'STORAGE_REMOVE_FAILED'; }
    }
    try {
      const result = await rpc(admin, 'complete_memory_cleanup', {
        p_job_id: job.id, p_lease_token: job.leaseToken, p_error_code: code,
      });
      if (!result.ok) { completionFailed = true; continue; }
    } catch { completionFailed = true; continue; }
    if (code) retried += 1; else completed += 1;
  }
  // Process every lease first. An unrelated job must not lose an attempt without a removal call.
  if (completionFailed) throw new Error('Cleanup completion failed');
  return { completed, retried };
}
export async function handleCleanup(request: Request): Promise<Response> {
  if (request.method !== 'POST') return reply(failed('VALIDATION'));
  const secret = Deno.env.get('MEMORY_CLEANUP_SECRET');
  if (!secret || secret.length < 32) return reply(failed('RETRYABLE'));
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  // Hash both values before comparison so equality does not expose the secret's prefix.
  const [left, right] = await Promise.all([secret, token].map(value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
  const a = new Uint8Array(left); const b = new Uint8Array(right);
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) mismatch |= a[index] ^ b[index];
  if (mismatch) return reply(failed('UNAUTHENTICATED'));
  const admin = serviceClient();
  if (!admin) return reply(failed('RETRYABLE'));
  try { return reply({ ok: true, data: await runCleanup(admin) }); }
  catch { return reply(failed('RETRYABLE')); }
}
