import { z } from 'zod';
import { captureQueryScope } from '../../lib/query-client';
import { getSupabase, type RpcName } from '../../lib/supabase';
import { AppError, resultSchema } from '@deseo/domain/result';

export async function memoryRpc<T extends z.ZodTypeAny>(name: RpcName, args: Record<string, unknown>, schema: T): Promise<z.infer<T>> {
  const scope = captureQueryScope();
  const client = getSupabase();
  scope.assertCurrent();
  const { data, error } = await client.rpc(name, args).abortSignal(scope.signal);
  scope.assertCurrent();
  if (error) throw error;
  const result = resultSchema(schema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}
