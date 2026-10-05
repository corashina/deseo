import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptInvite, previewInvite, inviteTokenSchema, type InvitePreview } from '..';
import { entryIntent } from '../../auth';
import { useSession } from '../../../app/SessionProvider';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { isOnline, useNetworkStatus } from '../../../lib/network';
type ReviewedInvite = { token: string; details: InvitePreview; commandId: string };
export function JoinPage() {
  const online = useNetworkStatus();
  const { revalidate } = useSession();
  const [initialToken] = useState(entryIntent.invite);
  const [token, setToken] = useState(initialToken ?? '');
  const [reviewed, setReviewed] = useState<ReviewedInvite | null>(null);
  const generation = useRef(0);
  const [pending, setPending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const review = useCallback(async (value: string) => {
    if (!isOnline()) return;
    const request = ++generation.current;
    const parsed = inviteTokenSchema.safeParse(value);
    setReviewed(null); setError('');
    if (!parsed.success) { setError('Enter the 12-character invitation code.'); return; }
    setPending(true);
    const result = await previewInvite(parsed.data);
    if (request !== generation.current) return;
    setPending(false);
    if (result.ok) {
      entryIntent.invite = parsed.data;
      setReviewed({ token: parsed.data, details: result.data, commandId: crypto.randomUUID() });
    } else setError(result.error.message ?? 'This invitation is unavailable.');
  }, []);
  useEffect(() => {
    if (initialToken) void review(initialToken);
    return () => { generation.current++; };
  }, [initialToken, review]);
  const preview = reviewed?.details;
  return <section className="card form-page"><PageHeader title={preview ? 'Join ' + preview.inviterName : 'Join your partner'} description={preview ? 'You will share one pair in ' + preview.timezone + '.' : 'Enter the invitation code from your partner.'} />
    <form onSubmit={event => { event.preventDefault(); if (!isOnline() || pending || accepting) return; void review(token); }}>
    <Field label="Invitation code" value={token} disabled={accepting} onChange={event => {
      generation.current++; setPending(false); setToken(event.target.value); setReviewed(null); setError(''); entryIntent.invite = null;
    }} autoComplete="off" />
    {!preview && <Button type="submit" disabled={pending || accepting || !online}>Review invitation</Button>}</form>
    {reviewed && <><p className="muted">Expires {new Date(reviewed.details.expiresAt).toLocaleString()}</p><Button disabled={accepting || !online} onClick={async () => {
      if (!isOnline() || accepting) return;
      setAccepting(true); setError('');
      const result = await acceptInvite(reviewed.token, reviewed.commandId);
      if (result.ok) await revalidate();
      else { setError(result.error.message ?? 'This invitation is unavailable.'); setAccepting(false); }
    }}>Join pair</Button></>}
    {error && <Status error>{error}</Status>}<Link to="/pair/start" onClick={() => { entryIntent.invite = null; }}>Back</Link></section>;
}
