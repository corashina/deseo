import type { Message } from '@deseo/domain/messages';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
const timestamp = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export function NoteCard({ message, name, own = false, disabled = false, onUnpin }: {
  message: Message; name: string; own?: boolean; disabled?: boolean; onUnpin?(message: Message): void;
}) {
  return <article className="card note-card" data-testid="note-card">
    <h2>From {name}</h2><p className="preserve-lines">{message.body}</p>
    <time dateTime={message.pinnedAt ?? message.createdAt}>{timestamp.format(new Date(message.pinnedAt ?? message.createdAt))}</time>
    <div className="message-actions"><Link to="/messages">Reply</Link>{own && onUnpin && <Button variant="secondary" disabled={disabled} onClick={() => onUnpin(message)}>Unpin note</Button>}</div>
  </article>;
}
