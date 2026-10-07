import type { Message } from '@deseo/domain/messages';
import { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
const timestamp = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export function MessageRow({ message, name, slot, own, disabled, onPin, onDelete }: {
  message: Message; name: string; slot: 'a' | 'b'; own: boolean; disabled: boolean;
  onPin(message: Message): void; onDelete(message: Message): void;
}) {
  const actions = useRef<HTMLDetailsElement>(null);
  const menuId = useId();
  const [expanded, setExpanded] = useState(false);
  function closeActions() {
    actions.current?.querySelector('summary')?.focus();
    if (actions.current) actions.current.open = false;
  }
  return <article className={'message-row partner-' + slot + (own ? ' own-message' : '')} data-testid="message-row" data-message-id={message.id}>
    <div className="message-meta"><strong>{name}</strong><time dateTime={message.createdAt}>{timestamp.format(new Date(message.createdAt))}</time></div>
    <p className="preserve-lines">{message.body}</p>
    <span className="message-state">Sent{message.pinnedAt ? ' · Pinned note' : ''}</span>
    {own && <details className="message-actions" ref={actions} onToggle={event => setExpanded(event.currentTarget.open)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeActions(); } }}>
      <summary role="button" aria-label="Message actions" aria-controls={menuId} aria-expanded={expanded} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}>Actions</summary>
      <div className="message-action-menu" id={menuId}>
        <Button variant="secondary" disabled={disabled} onClick={() => { closeActions(); onPin(message); }}>{message.pinnedAt ? 'Unpin note' : 'Pin note'}</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => { closeActions(); onDelete(message); }}>Delete message</Button>
      </div>
    </details>}
  </article>;
}
