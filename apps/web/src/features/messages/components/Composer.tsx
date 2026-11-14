import { useId } from 'react';
import { messageBodySchema } from '@deseo/domain/messages';
import { Button } from '../../../components/ui/Button';
export function Composer({ body, disabled, onChange, onSend }: { body: string; disabled: boolean; onChange(body: string): void; onSend(): void }) {
  const id = useId();
  return <form className="card message-composer" onSubmit={event => { event.preventDefault(); onSend(); }}>
    <div className="field"><label htmlFor={id}>Message</label><textarea id={id} name="body" autoComplete="off" rows={3} value={body} onChange={event => onChange(event.target.value)} /></div>
    <div className="composer-footer"><span className="muted">{Array.from(body).length} / 4,000</span><Button type="submit" disabled={disabled || !messageBodySchema.safeParse(body).success}>Send message</Button></div>
  </form>;
}
