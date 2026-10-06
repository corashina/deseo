import { z } from 'zod';
import { captureQueryScope } from '../../lib/query-client';
import { getSupabase } from '../../lib/supabase';
import { AppError, resultSchema } from '@deseo/domain/result';

export async function memoryRpc<T extends z.ZodTypeAny>(name: string, args: Record<string, unknown>, schema: T): Promise<z.infer<T>> {
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
export async function memoryFunction<T extends z.ZodTypeAny>(name: string, body: Record<string, unknown>, schema: T): Promise<z.infer<T>> {
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const { data, error } = await client.functions.invoke(name, { body, method: 'POST', signal: scope.signal });
  scope.assertCurrent();
  if (error) {
    const response = error.context as Response | undefined;
    if (response && typeof response.json === 'function') {
      const body: unknown = await response.json().catch(() => null);
      scope.assertCurrent();
      const parsed = resultSchema(schema).safeParse(body);
      if (parsed.success && !parsed.data.ok) throw new AppError(parsed.data.error);
    }
    throw new AppError({ code: 'RETRYABLE', message: 'Check your connection and retry.' });
  }
  const result = resultSchema(schema).parse(data);
  if (!result.ok) throw new AppError(result.error);
  return result.data;
}
