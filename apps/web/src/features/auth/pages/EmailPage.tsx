import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestEmailCode, entryIntent } from '..';
import { useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function EmailPage() {
  const online = useNetworkStatus();
  const navigate = useNavigate();
  const [email, setEmail] = useState(entryIntent.emailDraft || entryIntent.email);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const beginScope = useCommandScope(() => setPending(false));
  useUnsavedChanges(Boolean(email) && !sent, 'email');
  useEffect(() => { if (sent) navigate('/verify'); }, [sent, navigate]);
  return <section className="card form-page"><PageHeader title="Sign in with email" description="We will send you a six-digit code." />
    <form onSubmit={async event => { event.preventDefault(); if (!isOnline() || pending) return; const scope = beginScope(); setPending(true); setError('');
      const result = await requestEmailCode(email); if (!scope.isCurrent()) return; setPending(false);
      if (result.ok) setSent(true); else setError(result.error.message ?? 'Check your email address.');
    }}><Field label="Email address" type="email" autoComplete="email" required value={email} disabled={pending} onChange={event => { entryIntent.emailDraft = event.target.value; setEmail(event.target.value); }} />
    {error && <Status error>{error}</Status>}<Button type="submit" disabled={pending || !online}>{pending ? 'Sending…' : 'Send code'}</Button></form><Link to="/welcome">Back</Link></section>;
}
