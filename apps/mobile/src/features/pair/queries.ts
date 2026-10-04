import { getSupabase } from '../../lib/supabase';
import { AppError, resultSchema } from '../../lib/result';
import { captureQueryScope } from '../../lib/query-client';
import { pairContextSchema } from './schema';
import type { PairContext } from './types';
import { getPrivateStorage } from '../../lib/private-storage';

export async function getPairContext(): Promise<PairContext> {
  const scope = captureQueryScope();
  const { data, error } = await (await getSupabase()).rpc('get_pair_context');
  scope.assertCurrent();
  if (error) throw error;
  const result = resultSchema(pairContextSchema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}

export const pairKeys = { context: (accountId: string) => ['account', accountId, 'pair'] as const };

export async function restorePairContext(accountId: string): Promise<PairContext> {
  const scope = captureQueryScope();
  const pair = await getPairContext();
  const storage = await getPrivateStorage();
  const key = `lastPair:${accountId}`;
  const previous = await storage.getIntent(key);
  scope.assertCurrent();
  const current = pair.status === 'active' || pair.status === 'pending' ? pair.pairId : null;
  if (previous && previous !== current) await storage.purgePairDrafts(accountId, previous);
  if (current) await storage.setIntent(key, current);
  else await storage.removeIntent(key);
  scope.assertCurrent();
  return pair;
}
