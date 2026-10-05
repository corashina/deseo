import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { entryIntent, requestEmailCode, verifyEmailCode } from '..';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function VerifyPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!entryIntent.email) return <Navigate to="/sign-in" replace />;
  const seconds = Math.max(0, Math.ceil((Date.parse(entryIntent.retryAt) - now) / 1000));
  return <section className="card form-page"><PageHeader title="Check your email" description={'Enter the code sent to ' + entryIntent.email + '.'} />
    <form noValidate onSubmit={async event => { event.preventDefault();
      if (!/^\d{6}$/.test(code)) { setError('Enter six digits from your email.'); return; }
      setPending(true); setError(''); const result = await verifyEmailCode(entryIntent.email, code);
      setPending(false); if (!result.ok) setError(result.error.message ?? 'Request a new code.');
    }}><Field label="Sign-in code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value)} />
    {error && <Status error>{error}</Status>}<Button type="submit" disabled={pending}>{pending ? 'Checking…' : 'Sign in'}</Button></form>
    <Button variant="secondary" disabled={pending || seconds > 0} onClick={async () => { setPending(true); const result = await requestEmailCode(entryIntent.email); setPending(false); setNow(Date.now()); if (!result.ok) setError(result.error.message ?? 'Try again.'); }}>{seconds ? 'Resend code in ' + seconds + 's' : 'Resend code'}</Button><Link to="/sign-in">Use another email</Link></section>;
}
