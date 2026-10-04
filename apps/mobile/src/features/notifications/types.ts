import type { z } from 'zod';
import type { deviceSchema, preferencesSchema, reminderInputSchema, reminderSchema, destinationSchema, notificationSchema, permissionSchema } from './schema';
export type DeviceInput = z.infer<typeof deviceSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type NotificationPreferences = z.infer<typeof preferencesSchema>;
export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type AllowedDestination = z.infer<typeof destinationSchema>;
export type Notification = z.infer<typeof notificationSchema>;
