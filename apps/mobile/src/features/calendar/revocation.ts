import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';

export async function reconcileEventDrafts(accountId: string, pairId: string): Promise<void> {
  const scope = captureQueryScope();
  const { data, error } = await (await getSupabase()).from('event_access_revocations').select('event_id')
    .eq('user_id', accountId).eq('pair_id', pairId).abortSignal(scope.signal);
  scope.assertCurrent();
  if (error) throw error;
  const revoked = z.array(z.object({ event_id: z.string().uuid() })).parse(data);
  const storage = await getPrivateStorage();
  for (const row of revoked) {
    scope.assertCurrent();
    await storage.removeDraft(accountId, pairId, `calendar:${row.event_id}`);
  }
  scope.assertCurrent();
}
