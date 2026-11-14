import type { z } from 'zod';
import { AppError, resultSchema, toAppError } from '@deseo/domain/result';
import { getSupabase, type RpcName } from './supabase';
// Run one RPC and return its data. Throw an AppError on failure.
export async function callRpc<T extends z.ZodTypeAny>(name: RpcName, args: Record<string, unknown>, schema: T): Promise<z.infer<T>> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw toAppError(error);
  const result = resultSchema(schema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}
