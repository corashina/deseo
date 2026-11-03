import type { Message } from '@deseo/domain/messages';
import { formatInstant } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
export function NoteCard({ message, name, own = false, disabled = false, onUnpin }: {
  message: Message; name: string; own?: boolean; disabled?: boolean; onUnpin?(message: Message): void;
}) {
  const { account } = useSession();
  return <article className="card note-card" data-testid="note-card">
    <h2>From {name}</h2><p className="preserve-lines">{message.body}</p>
    <time dateTime={message.pinnedAt ?? message.createdAt}>{formatInstant(message.pinnedAt ?? message.createdAt, account!.timezone)}</time>
    <div className="message-actions"><Link to="/messages">Reply</Link>{own && onUnpin && <Button variant="secondary" disabled={disabled} onClick={() => onUnpin(message)}>Unpin note</Button>}</div>
  </article>;
}
