import { DateTime } from 'luxon';
import { AppError } from '../../lib/result';
export function taskReminderInstant(date: string, time: string, zone: string): string {
  const local = `${date}T${time}`; const parsed = DateTime.fromISO(local, { zone });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !parsed.isValid
    || parsed.toFormat("yyyy-MM-dd'T'HH:mm") !== local || parsed.getPossibleOffsets().length !== 1) {
    throw new AppError({ code: 'VALIDATION', message: 'Choose a valid time outside the daylight-saving clock change.' });
  }
  return parsed.toUTC().toISO()!;
}
