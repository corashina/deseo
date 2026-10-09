import { pairContextSchema } from '@deseo/domain/pair';
import { AppError, resultSchema } from '@deseo/domain/result';
import { captureQueryScope } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
export async function getPairContext() {
  const scope = captureQueryScope();
  const { data, error } = await getSupabase().rpc('get_pair_context').abortSignal(scope.signal);
  scope.assertCurrent();
  if (error) throw error;
  const result = resultSchema(pairContextSchema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}
