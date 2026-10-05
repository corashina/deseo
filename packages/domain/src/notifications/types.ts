import type { z } from 'zod';
import type { preferencesSchema, reminderInputSchema, reminderSchema, destinationSchema, notificationSchema } from './schema';
export type NotificationPreferences = z.infer<typeof preferencesSchema>;
export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type AllowedDestination = z.infer<typeof destinationSchema>;
export type Notification = z.infer<typeof notificationSchema>;
