import type { Page } from '@deseo/domain/result';
import type { Message, MessageCursor } from '@deseo/domain/messages';
import type { PendingMessage } from './types';

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

export function flattenMessagePages(pages: readonly Page<Message>[]): Message[] {
  const messages = new Map<string, Message>();
  for (const page of pages) {
    for (const message of page.items) {
      const previous = messages.get(message.id);
      if (!previous || message.version > previous.version) messages.set(message.id, message);
    }
  }
  return [...messages.values()].sort((left, right) => compareMessageCursors(right, left));
}

export function reconcilePendingMessages(
  pending: readonly PendingMessage[], messages: readonly Message[], deletedClientIds: readonly string[] = [],
): PendingMessage[] {
  const confirmed = new Set(messages.map(message => message.clientId));
  for (const id of deletedClientIds) confirmed.add(id);
  return pending.filter(message => !confirmed.has(message.clientId));
}
