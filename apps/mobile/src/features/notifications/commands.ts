import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { preferencesSchema, reminderInputSchema, reminderSchema, destinationSchema } from '@deseo/domain/notifications';
import { deviceSchema } from './schema';
import type { NotificationPreferences, ReminderInput } from '@deseo/domain/notifications';
import type { DeviceInput } from './types';
const uuid = z.string().uuid();
export async function notificationCommand<T extends z.ZodTypeAny>(name: string, parameters: Record<string, unknown>, schema: T): Promise<Result<z.infer<T>>> {
  try {
    const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
    const { data, error } = await client.rpc(name, parameters).abortSignal(scope.signal); scope.assertCurrent();
    if (error) return errorResult(error);
    const result = resultSchema(schema).parse(data);
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    scope.assertCurrent(); return result;
  } catch (error) { return errorResult(error); }
}
export async function registerDevice(input: DeviceInput) {
  try { return await notificationCommand('register_device', { p_input: deviceSchema.parse(input) }, z.object({ deviceId: uuid })); }
  catch (error) { return errorResult(error); }
}
export async function revokeDevice(installationId: string, all = false) {
  try { return await notificationCommand('revoke_device', { p_installation_id: uuid.parse(installationId), p_all: all }, z.object({ revoked: z.literal(true) })); }
  catch (error) { return errorResult(error); }
}
export async function saveNotificationPreferences(input: NotificationPreferences) {
  try { const parsed = preferencesSchema.parse(input); const { version, ...values } = parsed;
    return await notificationCommand('save_notification_preferences', { p_input: values, p_expected_version: version }, preferencesSchema); }
  catch (error) { return errorResult(error); }
}
export async function setReminder(input: ReminderInput, commandId: string) {
  try { return await notificationCommand('set_reminder', { p_input: reminderInputSchema.parse(input), p_command_id: uuid.parse(commandId) }, reminderSchema); }
  catch (error) { return errorResult(error); }
}
export async function resolveNotification(id: string) {
  try { return await notificationCommand('resolve_notification', { p_id: uuid.parse(id) }, destinationSchema); }
  catch (error) { return errorResult(error); }
}
export async function markNotificationRead(id: string) {
  try { return await notificationCommand('mark_notification_read', { p_id: uuid.parse(id) }, z.object({ id: uuid })); }
  catch (error) { return errorResult(error); }
}
