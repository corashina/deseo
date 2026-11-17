import type { Message } from '@deseo/domain/messages';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';

// A pinned note above the conversation. It shows two lines, one on phones; the message in the conversation shows all.
export function NoteCard({ message, name, own, disabled, error, onRetry, onUnpin }: {
  message: Message; name: string; own: boolean; disabled: boolean; error?: string; onRetry?(): void; onUnpin(message: Message): void;
}) {
  return <article className="note-card" data-testid="note-card">
    <div className="note-card-copy"><span className="eyebrow">From {own ? 'you' : name}</span><p>{message.body}</p></div>
    {own && <Button variant="text" disabled={disabled} onClick={() => onUnpin(message)}>Unpin</Button>}
    {error && <div className="message-error"><Status error>{error}</Status>{onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}</div>}
  </article>;
}
