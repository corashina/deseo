// Importance: 98. Input and response validation must reject event reminders without a delivery window.
import { preferencesSchema, reminderInputSchema, reminderSchema } from './schema';
const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const preferences = { messageAlerts: false, quietStart: null, quietEnd: null, timezone: 'Europe/Warsaw', version: 1 };
const reminder = { id, pairId: id, eventId: id, taskId: null, remindAt: null, active: true };
test.each([
  ['preferences', () => preferencesSchema.safeParse({ ...preferences, defaultEventReminderMinutes: 0 }).success],
  ['reminder input', () => reminderInputSchema.safeParse({ ...reminder, minutesBefore: 0, expectedVersion: null }).success],
  ['reminder response', () => reminderSchema.safeParse({ ...reminder, minutesBefore: 0, version: 1, state: 'scheduled' }).success],
] as const)('rejects zero-offset %s', (_name, parse) => { expect(parse()).toBe(false); });
test.each([15, 60, 1440])('accepts the %s-minute advance offset', minutes => {
  expect(preferencesSchema.safeParse({ ...preferences, defaultEventReminderMinutes: minutes }).success).toBe(true);
  expect(reminderInputSchema.safeParse({ ...reminder, minutesBefore: minutes, expectedVersion: null }).success).toBe(true);
  expect(reminderSchema.safeParse({ ...reminder, minutesBefore: minutes, version: 1, state: 'scheduled' }).success).toBe(true);
});
test('accepts disabled reminders and no default reminder', () => {
  expect(preferencesSchema.safeParse({ ...preferences, defaultEventReminderMinutes: null }).success).toBe(true);
  expect(reminderInputSchema.safeParse({ ...reminder, active: false, minutesBefore: null, expectedVersion: null }).success).toBe(true);
});
