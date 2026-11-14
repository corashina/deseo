import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { formatDate, formatRange } from './format.ts';

const lateEvening = DateTime.fromISO('2026-11-14T23:30:00Z').setZone('Europe/Warsaw');

test('formats in the display timezone', () => {
  assert.equal(formatDate(lateEvening, 'day', 'en'), 'Nov 15');
});

test('formats in the account locale', () => {
  assert.equal(formatDate(lateEvening, 'month', 'pl'), 'listopad 2026');
});

test('collapses a range in the same month', () => {
  assert.equal(formatRange(lateEvening, lateEvening.plus({ days: 2 }), 'day', 'en'), 'Nov 15 – 17');
});
