import { formatInstant } from '@deseo/domain/calendar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptInvite, previewInvite, inviteTokenSchema, type InvitePreview } from '..';
import { entryIntent } from '../../auth';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { isOnline, useNetworkStatus } from '../../../lib/network';
type ReviewedInvite = { token: string; details: InvitePreview; commandId: string };
export function JoinPage() {
  const online = useNetworkStatus();
  const { account, pair, revalidate } = useSession();
  const accountId = account!.id;
  const pairId = pair && 'pairId' in pair ? pair.pairId : null;
  const [saved] = useState(() => readDraft<{ token: string; attempt?: ReviewedInvite }>(accountId, pairId, 'join-pair'));
  const [initialToken] = useState(saved?.token ?? entryIntent.invite);
  const [token, setToken] = useState(initialToken ?? '');
  const [reviewed, setReviewed] = useState<ReviewedInvite | null>(saved?.attempt ?? null);
  const attempt = useRef(saved?.attempt);
  const generation = useRef(0);
  const [pending, setPending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [uncertain, setUncertain] = useState(Boolean(attempt.current));
  const beginScope = useCommandScope(() => { setPending(false); setAccepting(false); });
  useUnsavedChanges(!confirmed && (Boolean(token) || uncertain));
  const review = useCallback(async (value: string) => {
    if (!isOnline()) return;
    const scope = beginScope();
    const request = ++generation.current;
    const parsed = inviteTokenSchema.safeParse(value);
    setReviewed(null); setError('');
    if (!parsed.success) { setError('Enter the 12-character invitation code.'); return; }
    setPending(true);
    const result = await previewInvite(parsed.data);
    if (request !== generation.current || !scope.isCurrent()) return;
    setPending(false);
    if (result.ok) {
      entryIntent.invite = parsed.data;
      writeDraft(accountId, pairId, 'join-pair', { token: parsed.data });
      setReviewed({ token: parsed.data, details: result.data, commandId: crypto.randomUUID() });
    } else setError(result.error.message ?? 'This invitation is unavailable.');
  }, [beginScope, accountId, pairId]);
  useEffect(() => {
    if (initialToken && !attempt.current) void review(initialToken);
    return () => { generation.current++; };
  }, [initialToken, review]);
  const preview = reviewed?.details;
  return <section className="card form-page"><PageHeader title={preview ? 'Join ' + preview.inviterName : 'Join your partner'} description={preview ? 'Share plans, messages, and memories. Private events stay private.' : 'Enter the invitation code from your partner.'} />
    <form onSubmit={event => { event.preventDefault(); if (!isOnline() || pending || accepting || uncertain) return; void review(token); }}>
    <Field label="Invitation code" value={token} disabled={accepting || uncertain} onChange={event => {
      generation.current++; setPending(false); setToken(event.target.value); writeDraft(accountId, pairId, 'join-pair', { token: event.target.value }); setReviewed(null); setError(''); entryIntent.invite = null;
    }} autoComplete="off" />
    {!preview && <Button type="submit" disabled={pending || accepting || !online}>Review invitation</Button>}</form>
    {reviewed && <><p className="muted">Pair timezone: {reviewed.details.timezone}</p><p className="muted">Expires {formatInstant(reviewed.details.expiresAt, account!.timezone)}</p><Button disabled={accepting || !online} onClick={async () => {
      if (!isOnline() || accepting) return;
      const scope = beginScope();
      const next = attempt.current ?? reviewed;
      attempt.current = next; writeDraft(accountId, pairId, 'join-pair', { token: next.token, attempt: next });
      setUncertain(true); setAccepting(true); setError('');
      const result = await acceptInvite(next.token, next.commandId);
      if (!scope.isCurrent()) return;
      if (result.ok) { removeDraft(accountId, pairId, 'join-pair'); setConfirmed(true); await revalidate(); }
      else { setError(result.error.message ?? 'This invitation is unavailable.'); setAccepting(false); if (result.error.code !== 'RETRYABLE') { attempt.current = undefined; setUncertain(false); writeDraft(accountId, pairId, 'join-pair', { token }); } }
    }}>{uncertain ? 'Retry joining pair' : 'Join pair'}</Button></>}
    {error && <Status error>{error}</Status>}<Link to="/pair/start" onClick={() => { entryIntent.invite = null; }}>Back</Link></section>;
}
