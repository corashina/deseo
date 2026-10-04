// Importance: 98. Task reminders must not silently move through DST gaps or overlaps.
import { taskReminderInstant } from './time';
test('preserves a chosen pair-local time as an instant', () => {
  expect(taskReminderInstant('2026-10-25', '09:00', 'Europe/Warsaw')).toBe('2026-10-25T08:00:00.000Z');
});
test('rejects DST gaps and ambiguous times', () => {
  expect(() => taskReminderInstant('2026-03-29', '02:30', 'Europe/Warsaw')).toThrow();
  expect(() => taskReminderInstant('2026-10-25', '02:30', 'Europe/Warsaw')).toThrow();
});
