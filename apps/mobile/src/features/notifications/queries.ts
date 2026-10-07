import { z } from 'zod';
import { getSupabase, type RpcName } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError, resultSchema } from '@deseo/domain/result';
import { notificationPageSchema, preferencesSchema, reminderSchema } from '@deseo/domain/notifications';
export const notificationKeys = {
  preferences: (account: string) => ['notifications', account, 'preferences'] as const,
  list: (account: string, pair: string) => ['notifications', account, pair, 'list'] as const,
  reminder: (account: string, pair: string, source: string) => ['notifications', account, pair, 'reminder', source] as const,
};
async function read<T extends z.ZodTypeAny>(name: RpcName, parameters: Record<string, unknown>, schema: T, wrapped = true): Promise<z.infer<T>> {
  const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
  const { data, error } = await client.rpc(name, parameters).abortSignal(scope.signal); scope.assertCurrent();
  if (error) throw error;
  if (!wrapped) return schema.parse(data);
  const result = resultSchema(schema).parse(data); if (!result.ok) throw new AppError(result.error); return result.data;
}
export const getNotificationPreferences = () => read('get_notification_preferences', {}, preferencesSchema);
export function getReminder(eventId: string | null, taskId: string | null) {
  z.string().uuid().parse(eventId ?? taskId);
  if ((eventId !== null) === (taskId !== null)) throw new AppError({ code: 'VALIDATION' });
  return read('get_reminder', { p_event_id: eventId, p_task_id: taskId }, reminderSchema.nullable());
}
export function listNotifications(cursor: string | null = null) {
  return read('list_notifications', { p_cursor: cursor }, notificationPageSchema, false);
}
