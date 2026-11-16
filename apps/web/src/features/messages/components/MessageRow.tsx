import type { Message } from '@deseo/domain/messages';
import { useId, useRef, useState } from 'react';
import { DotsThreeIcon } from '@phosphor-icons/react/dist/csr/DotsThree';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { DateTime } from 'luxon';
import { formatDate } from '../../../lib/format';

// Today's messages show the time only. Older ones add the day; the year shows only when it differs.
function sentAt(value: string, timezone: string, locale: string): string {
  const sent = DateTime.fromISO(value).setZone(timezone);
  const now = DateTime.now().setZone(timezone);
  if (sent.hasSame(now, 'day')) return formatDate(sent, 'time', locale);
  return formatDate(sent, sent.hasSame(now, 'year') ? 'dayTime' : 'dateTime', locale);
}

export function MessageRow({ message, name, slot, own, latest, disabled, timezone, locale, error, onRetry, onPin, onDelete }: {
  message: Message; name: string; slot: 'a' | 'b'; own: boolean; latest: boolean; disabled: boolean; timezone: string; locale: string;
  error?: string; onRetry?(): void; onPin(message: Message): void; onDelete(message: Message): void;
}) {
  const actions = useRef<HTMLDetailsElement>(null);
  const menuId = useId();
  const [expanded, setExpanded] = useState(false);
  // Show Sent only on the viewer's latest message. It confirms the whole conversation.
  const state = [latest && 'Sent', message.pinnedAt && 'Pinned note'].filter(Boolean).join(' · ');
  function closeActions() {
    actions.current?.querySelector('summary')?.focus();
    if (actions.current) actions.current.open = false;
  }
  return <article className={'message-row partner-' + slot + (own ? ' own-message' : '')} data-testid="message-row" data-message-id={message.id}>
    <div className="message-meta"><strong>{name}</strong><time dateTime={message.createdAt}>{sentAt(message.createdAt, timezone, locale)}</time>
      {own && <details className="message-actions" ref={actions} onToggle={event => setExpanded(event.currentTarget.open)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeActions(); } }}>
        <summary role="button" aria-label="Message actions" title="Message actions" aria-controls={menuId} aria-expanded={expanded} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}><DotsThreeIcon size={20} weight="bold" aria-hidden="true" /></summary>
        <div className="message-action-menu" id={menuId}>
          <Button variant="text" disabled={disabled} onClick={() => { closeActions(); onPin(message); }}>{message.pinnedAt ? 'Unpin note' : 'Pin note'}</Button>
          <Button variant="text" disabled={disabled} onClick={() => { closeActions(); onDelete(message); }}>Delete message</Button>
        </div>
      </details>}
    </div>
    <p className="preserve-lines">{message.body}</p>
    {state && <span className="message-state">{state}</span>}
    {error && <div className="message-error"><Status error>{error}</Status>{onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}</div>}
  </article>;
}
