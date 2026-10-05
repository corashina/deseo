import type { Message } from '@deseo/domain/messages';
import { Button } from '../../../components/ui/Button';
const timestamp = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export function MessageRow({ message, name, slot, own, disabled, onPin, onDelete }: {
  message: Message; name: string; slot: 'a' | 'b'; own: boolean; disabled: boolean;
  onPin(message: Message): void; onDelete(message: Message): void;
}) {
  return <article className={'message-row partner-' + slot + (own ? ' own-message' : '')} data-testid="message-row" data-message-id={message.id}>
    <div className="message-meta"><strong>{name}</strong><time dateTime={message.createdAt}>{timestamp.format(new Date(message.createdAt))}</time></div>
    <p className="preserve-lines">{message.body}</p>
    <span className="message-state">Sent{message.pinnedAt ? ' · Pinned note' : ''}</span>
    {own && <div className="message-actions"><Button variant="secondary" disabled={disabled} onClick={() => onPin(message)}>{message.pinnedAt ? 'Unpin note' : 'Pin note'}</Button><Button variant="secondary" disabled={disabled} onClick={() => onDelete(message)}>Delete message</Button></div>}
  </article>;
}
