import { DateTime } from 'luxon';
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { acceptInvite, previewInvite, inviteTokenSchema } from '..';
import { entryIntent } from '../../auth';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { PageHeader } from '../../../components/ui/PageHeader';
export function JoinPage() {
  const { account, revalidate } = useSession();
  const [initialToken] = useState(entryIntent.invite);
  const [token, setToken] = useState(initialToken ?? '');
  const [invalid, setInvalid] = useState(false);
  const review = useMutation({ mutationFn: async (value: string) => ({ token: value, details: await previewInvite(value) }),
    onSuccess: result => { entryIntent.invite = result.token; } });
  const accept = useMutation({ mutationFn: acceptInvite, onSuccess: () => revalidate() });
  useUnsavedChanges(!accept.isSuccess && Boolean(token));
  // An error in the code moves focus to the field, where the person fixes it.
  const form = useRef<HTMLFormElement>(null);
  const focusToken = () => form.current?.querySelector<HTMLInputElement>('input[name=invitationCode]')?.focus();
  useEffect(() => { if (review.isError) focusToken(); }, [review.isError]);
  const start = (value: string) => {
    const parsed = inviteTokenSchema.safeParse(value);
    setInvalid(!parsed.success);
    if (parsed.success) review.mutate(parsed.data); else focusToken();
  };
  const { mutate } = review;
  useEffect(() => { if (initialToken) mutate(initialToken); }, [initialToken, mutate]);
  const reviewed = review.data;
  const preview = reviewed?.details;
  const busy = review.isPending || accept.isPending;
  const tokenError = invalid ? 'Enter the 12-character code or the invitation link.' : review.isError ? toAppError(review.error).message : '';
  return <section className="card form-page centered-card"><PageHeader title={preview ? 'Join ' + preview.inviterName : 'Join your partner'} description={preview ? 'Share plans, messages, and memories. Private events stay private.' : 'Paste the code or link from your partner.'} />
    <form ref={form} onSubmit={event => { event.preventDefault(); if (!busy) start(token); }}>
    <Field label="Invitation code or link" name="invitationCode" spellCheck={false} value={token} disabled={accept.isPending} error={tokenError} onChange={event => {
      setToken(event.target.value); review.reset(); accept.reset(); setInvalid(false); entryIntent.invite = null;
    }} autoComplete="off" />
    {!preview && <Button variant="primary" type="submit" disabled={busy}>{review.isPending ? 'Checking…' : 'Review invitation'}</Button>}</form>
    {reviewed && preview && <><p className="muted">Expires {formatDate(DateTime.fromISO(preview.expiresAt).setZone(account!.timezone), 'dateTime', account!.locale)}</p>
      <Button variant="primary" disabled={accept.isPending} onClick={() => accept.mutate(reviewed.token)}>{accept.isPending ? 'Joining…' : accept.isError ? 'Retry joining pair' : 'Join pair'}</Button></>}
    {accept.isError && <Status error>{toAppError(accept.error).message}</Status>}<Link to="/pair/start" onClick={() => { entryIntent.invite = null; }}>Back</Link></section>;
}
