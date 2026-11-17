import { useId, useMemo, useRef, useState } from 'react';
import { messageBodyLimit as limit, messageBodySchema } from '@deseo/domain/messages';
import { Button } from '../../../components/ui/Button';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
// The composer keeps its own draft, so typing does not render the conversation again.
export function Composer({ disabled, locale, onSend }: { disabled: boolean; locale: string; onSend(body: string): void }) {
  const id = useId();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const input = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  useUnsavedChanges(Boolean(body));
  const length = Array.from(body).length;
  return <form className="card message-composer" onSubmit={event => {
    event.preventDefault();
    if (!messageBodySchema.safeParse(body).success) {
      setError(body.trim() ? 'Use ' + number.format(limit) + ' characters or less.' : 'Write a message first.');
      input.current?.focus();
      return;
    }
    setError('');
    setBody('');
    onSend(body);
  }}>
    {/* The field starts at one line and grows with the text, so the conversation keeps the space. */}
    <div className="field"><label className="visually-hidden" htmlFor={id}>Message</label>
      <div className="composer-row"><textarea ref={input} id={id} name="body" autoComplete="off" rows={1} placeholder="Message" value={body} aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-error' : undefined} onChange={event => { setError(''); setBody(event.target.value); }}
        onKeyDown={event => {
          // With a keyboard, Enter sends and Shift+Enter adds a line. Touch keyboards keep Enter for new lines.
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || !matchMedia('(pointer: fine)').matches) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }} />
        <Button variant="primary" type="submit" disabled={disabled}>Send message</Button></div>
      {error && <span className="field-error" role="alert" id={id + '-error'}>{error}</span>}</div>
    {length > limit * .9 && <div className="composer-footer"><span className="muted">{number.format(length)} / {number.format(limit)}</span></div>}
  </form>;
}
