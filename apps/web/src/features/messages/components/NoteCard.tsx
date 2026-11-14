import type { Message } from '@deseo/domain/messages';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { DateTime } from 'luxon';
import { formatDate } from '../../../lib/format';
export function NoteCard({ message, name, timezone, locale, own = false, disabled = false, onUnpin }: {
  message: Message; name: string; timezone: string; locale: string; own?: boolean; disabled?: boolean; onUnpin?(message: Message): void;
}) {
  return <article className="card note-card" data-testid="note-card">
    <h2>From {name}</h2><p className="preserve-lines">{message.body}</p>
    <time dateTime={message.pinnedAt ?? message.createdAt}>{formatDate(DateTime.fromISO(message.pinnedAt ?? message.createdAt).setZone(timezone), 'dateTime', locale)}</time>
    <div className="message-actions"><Link to="/messages">Reply</Link>{own && onUnpin && <Button variant="secondary" disabled={disabled} onClick={() => onUnpin(message)}>Unpin note</Button>}</div>
  </article>;
}
