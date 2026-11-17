import { useId, useRef, useState } from 'react';
import { messageBodySchema } from '@deseo/domain/messages';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
export function Composer({ body, disabled, onChange, onSend }: { body: string; disabled: boolean; onChange(body: string): void; onSend(): void }) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  const length = Array.from(body).length;
  return <form className="card message-composer" onSubmit={event => {
    event.preventDefault();
    if (!messageBodySchema.safeParse(body).success) {
      setError(body.trim() ? 'Use 4,000 characters or less.' : 'Write a message first.');
      input.current?.focus();
      return;
    }
    setError('');
    onSend();
  }}>
    {/* The field starts at one line and grows with the text, so the conversation keeps the space. */}
    <div className="field"><label htmlFor={id}>Message</label>
      <div className="composer-row"><textarea ref={input} id={id} name="body" autoComplete="off" rows={1} value={body} aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-error' : undefined} onChange={event => { setError(''); onChange(event.target.value); }} />
        <Button variant="primary" type="submit" disabled={disabled}>Send message</Button></div>
      {error && <span className="field-error" role="alert" id={id + '-error'}>{error}</span>}</div>
    <div className="composer-footer"><nav className="composer-links" aria-label="Add to your day"><Link to="/events/new">Add event</Link><Link to="/tasks">Add task</Link><Link to="/memories/new">Add memory</Link></nav>
      {length > 3600 && <span className="muted">{length} / 4,000</span>}</div>
  </form>;
}
