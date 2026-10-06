import { z } from 'zod';
import { errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { preferencesSchema, reminderInputSchema, reminderSchema, destinationSchema, type NotificationPreferences, type ReminderInput } from '@deseo/domain/notifications';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { assertOnline } from '../../lib/network';
async function command<T extends z.ZodTypeAny>(name: string, args: Record<string, unknown>, schema: T): Promise<Result<z.infer<T>>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const { data, error } = await getSupabase().rpc(name, args).abortSignal(scope.signal);
    scope.assertCurrent();
    if (error) throw error;
    return resultSchema(schema).parse(data);
  } catch (error) { return errorResult(error); }
}
export async function saveNotificationPreferences(input: NotificationPreferences) {
  try { const { version, ...values } = preferencesSchema.parse(input);
    return await command('save_notification_preferences', { p_input: values, p_expected_version: version }, preferencesSchema);
  } catch (error) { return errorResult(error); }
}
export async function setReminder(input: ReminderInput, commandId: string) {
  try { return await command('set_reminder', { p_input: reminderInputSchema.parse(input), p_command_id: z.string().uuid().parse(commandId) }, reminderSchema); }
  catch (error) { return errorResult(error); }
}
export const resolveNotification = (id: string) => command('resolve_notification', { p_id: z.string().uuid().parse(id) }, destinationSchema);
export const markNotificationRead = (id: string) => command('mark_notification_read', { p_id: z.string().uuid().parse(id) }, z.object({ id: z.string().uuid() }));
