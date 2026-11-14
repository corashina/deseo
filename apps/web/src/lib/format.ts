import { DateTime, Interval } from 'luxon';

const styles = {
  day: { day: 'numeric', month: 'short' },
  dayYear: { day: 'numeric', month: 'short', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'long' },
  date: { day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'long', day: 'numeric', month: 'long' },
  weekdayShort: { weekday: 'short', day: 'numeric' },
  weekdayName: { weekday: 'short' },
  month: { month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
  dateTime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof styles;

// Pass a DateTime already set to the display timezone.
export function formatDate(value: DateTime, style: DateStyle, locale: string): string {
  return value.setLocale(locale).toLocaleString(styles[style]);
}

// Intl joins the two ends and collapses shared parts, such as the same month.
export function formatRange(start: DateTime, end: DateTime, style: DateStyle, locale: string): string {
  return Interval.fromDateTimes(start.setLocale(locale), end.setLocale(locale)).toLocaleString(styles[style]);
}
