import type { MessageCursor } from './types';

function remainingMicroseconds(instant: string): number {
  const fraction = /\.(\d+)/.exec(instant)?.[1] ?? '';
  return Number(fraction.padEnd(6, '0').slice(3, 6));
}

export function compareMessageCursors(left: MessageCursor, right: MessageCursor): number {
  const milliseconds = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (milliseconds) return milliseconds;
  const microseconds = remainingMicroseconds(left.createdAt) - remainingMicroseconds(right.createdAt);
  if (microseconds) return microseconds;
  const leftId = left.id.toLowerCase();
  const rightId = right.id.toLowerCase();
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}
