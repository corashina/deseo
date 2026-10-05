import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptInvite, previewInvite, inviteTokenSchema, type InvitePreview } from '..';
import { entryIntent } from '../../auth';
import { useSession } from '../../../app/SessionProvider';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function JoinPage() {
  const { revalidate } = useSession();
  const [token, setToken] = useState(entryIntent.invite ?? '');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [commandId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    if (entryIntent.invite) void previewInvite(entryIntent.invite).then(result => { if (current) { if (result.ok) setPreview(result.data); else setError(result.error.message ?? 'This invitation is unavailable.'); } });
    return () => { current = false; };
  }, []);
  return <section className="card form-page"><PageHeader title={preview ? 'Join ' + preview.inviterName : 'Join your partner'} description={preview ? 'You will share one pair in ' + preview.timezone + '.' : 'Enter the invitation code from your partner.'} />
    <form onSubmit={async event => { event.preventDefault(); setError(''); setPending(true);
      const parsed = inviteTokenSchema.safeParse(token);
      if (!parsed.success) { setError('Enter the 12-character invitation code.'); setPending(false); return; }
      const result = await previewInvite(parsed.data); setPending(false);
      if (result.ok) { entryIntent.invite = parsed.data; setPreview(result.data); } else setError(result.error.message ?? 'This invitation is unavailable.');
    }}><Field label="Invitation code" value={token} onChange={event => { setToken(event.target.value); setPreview(null); }} autoComplete="off" />
    {!preview && <Button type="submit" disabled={pending}>Review invitation</Button>}</form>
    {preview && <><p className="muted">Expires {new Date(preview.expiresAt).toLocaleString()}</p><Button disabled={pending} onClick={async () => { setPending(true); setError(''); const result = await acceptInvite(token, commandId); if (result.ok) await revalidate(); else { setError(result.error.message ?? 'This invitation is unavailable.'); setPending(false); } }}>Join pair</Button></>}
    {error && <Status error>{error}</Status>}<Link to="/pair/start" onClick={() => { entryIntent.invite = null; }}>Back</Link></section>;
}
