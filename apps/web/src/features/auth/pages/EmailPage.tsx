import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { requestEmailCode, entryIntent, useGlobalSignOutFailure } from '..';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
import { BrandIcon } from '../../../components/ui/BrandIcon';
// The first screen: the story panel and the email form.
export function EmailPage() {
  const navigate = useNavigate();
  const globalFailure = useGlobalSignOutFailure();
  const [email, setEmail] = useState(entryIntent.emailDraft || entryIntent.email);
  const request = useMutation({ mutationFn: requestEmailCode });
  useUnsavedChanges(Boolean(email) && !request.isSuccess);
  useEffect(() => { if (request.isSuccess) navigate('/verify'); }, [request.isSuccess, navigate]);
  return <div className="entry-page">
    <div className="entry-story"><BrandIcon className="welcome-icon" alt="Deseo Two voices" size={96} priority /><h1>Plan your days together</h1><p>Keep your plans, messages, and memories in one place.</p></div>
    <section className="card entry-card centered-card">
      <PageHeader title={entryIntent.invite ? 'Your invitation is ready' : <>Sign in to <span translate="no">Deseo</span></>}
        description={entryIntent.invite ? 'Sign in to review your partner’s invitation. We will send you a 6-digit code.' : 'We will send you a 6-digit code.'} />
      {entryIntent.invalidInvite && <Status error>This invitation is invalid. Ask your partner for a new code.</Status>}
      {globalFailure && <Status error><p>This browser is signed out. Other sessions may still be active.</p><p>Sign in to the same account. In Settings, choose Sign out on all devices again.</p></Status>}
      <form onSubmit={event => { event.preventDefault(); if (!request.isPending) request.mutate(email); }}>
        <Field label="Email address" name="email" spellCheck={false} autoCorrect="off" enterKeyHint="send" type="email" autoComplete="email" required value={email} disabled={request.isPending} onChange={event => { entryIntent.emailDraft = event.target.value; setEmail(event.target.value); }} />
        {request.isError && <Status error>{toAppError(request.error).message}</Status>}
        <Button variant="primary" type="submit" disabled={request.isPending}>{request.isPending ? 'Sending…' : request.isError ? 'Retry' : 'Send code'}</Button>
      </form>
    </section>
  </div>;
}
