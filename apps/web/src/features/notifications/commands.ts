import { z } from 'zod';
import { preferencesSchema, reminderInputSchema, reminderSchema, destinationSchema, type NotificationPreferences, type ReminderInput } from '@deseo/domain/notifications';
import { callRpc } from '../../lib/rpc';
// The expected version makes a concurrent edit fail with CONFLICT.
export function saveNotificationPreferences(input: NotificationPreferences) {
  const { version, ...values } = preferencesSchema.parse(input);
  return callRpc('save_notification_preferences', { p_input: values, p_expected_version: version }, preferencesSchema);
}
// set_reminder takes a command ID. Each attempt sends a new one.
export function setReminder(input: ReminderInput) {
  return callRpc('set_reminder', { p_input: reminderInputSchema.parse(input), p_command_id: crypto.randomUUID() }, reminderSchema);
}
export const resolveNotification = (id: string) => callRpc('resolve_notification', { p_id: z.string().uuid().parse(id) }, destinationSchema);
export const markNotificationRead = (id: string) => callRpc('mark_notification_read', { p_id: z.string().uuid().parse(id) }, z.object({ id: z.string().uuid() }));
