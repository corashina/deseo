import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestEmailCode, entryIntent } from '..';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function EmailPage() {
  const online = useNetworkStatus();
  const navigate = useNavigate();
  const [email, setEmail] = useState(entryIntent.email);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return <section className="card form-page"><PageHeader title="Sign in with email" description="We will send you a six-digit code." />
    <form onSubmit={async event => { event.preventDefault(); if (!isOnline() || pending) return; setPending(true); setError('');
      const result = await requestEmailCode(email); setPending(false);
      if (result.ok) navigate('/verify'); else setError(result.error.message ?? 'Check your email address.');
    }}><Field label="Email address" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
    {error && <Status error>{error}</Status>}<Button type="submit" disabled={pending || !online}>{pending ? 'Sending…' : 'Send code'}</Button></form><Link to="/welcome">Back</Link></section>;
}
