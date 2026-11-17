import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { requestEmailCode, entryIntent } from '..';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function EmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(entryIntent.emailDraft || entryIntent.email);
  const request = useMutation({ mutationFn: requestEmailCode });
  useUnsavedChanges(Boolean(email) && !request.isSuccess);
  useEffect(() => { if (request.isSuccess) navigate('/verify'); }, [request.isSuccess, navigate]);
  return <section className="card form-page"><PageHeader title="Sign in with email" description="We will send you a 6-digit code." />
    <form onSubmit={event => { event.preventDefault(); if (!request.isPending) request.mutate(email); }}><Field label="Email address" name="email" spellCheck={false} type="email" autoComplete="email" required value={email} disabled={request.isPending} onChange={event => { entryIntent.emailDraft = event.target.value; setEmail(event.target.value); }} />
    {request.isError && <Status error>{toAppError(request.error).message}</Status>}<Button variant="primary" type="submit" disabled={request.isPending}>{request.isPending ? 'Sending…' : request.isError ? 'Retry' : 'Send code'}</Button></form><Link to="/welcome">Back</Link></section>;
}
