import type { Page } from '@deseo/domain/result';
import { compareMessageCursors, type Message } from '@deseo/domain/messages';
import type { PendingMessage } from './types';

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
