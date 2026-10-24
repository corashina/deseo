import type { Page } from '../result';
import type { Message } from './types';
import { compareMessageCursors } from './cursor';
import { encodeMessageCursor } from './schema';

export function mergeConfirmedMessagePages(pages: readonly Page<Message>[] | undefined, confirmed: Message): Page<Message>[] {
  if (!pages?.length) return [{ items: [confirmed], nextCursor: encodeMessageCursor({ createdAt: confirmed.createdAt, id: confirmed.id }) }];
  let latest = confirmed;
  let target = -1;
  const matches = (message: Message) => message.id === confirmed.id
    || message.authorId === confirmed.authorId && message.clientId === confirmed.clientId;
  pages.forEach((page, index) => {
    for (const message of page.items) {
      if (!matches(message)) continue;
      if (target < 0) target = index;
      if (message.version > latest.version) latest = message;
    }
  });
  if (target < 0) target = 0;
  return pages.map((page, index) => {
    const items = page.items.filter(message => !matches(message));
    if (index === target) {
      items.push(latest);
      items.sort((left, right) => compareMessageCursors(right, left));
    }
    return { ...page, items };
  });
}
