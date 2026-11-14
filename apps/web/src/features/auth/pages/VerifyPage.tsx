import { isOnline, useNetworkStatus } from '../../../lib/network';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { entryIntent, requestEmailCode, verifyEmailCode } from '..';
import { useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function VerifyPage() {
  const online = useNetworkStatus();
  const [code, setCode] = useState(entryIntent.codeDraft);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const beginScope = useCommandScope(() => setPending(false));
  useUnsavedChanges(Boolean(code), 'email-code');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!entryIntent.email) return <Navigate to="/sign-in" replace />;
  const seconds = Math.max(0, Math.ceil((Date.parse(entryIntent.retryAt) - now) / 1000));
  return <section className="card form-page"><PageHeader title="Check your email" description={'Enter the code sent to ' + entryIntent.email + '.'} />
    <form noValidate onSubmit={async event => { event.preventDefault(); if (!isOnline() || pending) return;
      if (!/^\d{6}$/.test(code)) { setError('Enter six digits from your email.'); return; }
      const scope = beginScope(); setPending(true); setError(''); const result = await verifyEmailCode(entryIntent.email, code);
      if (!scope.isCurrent()) return; setPending(false); if (!result.ok) setError(result.error.message ?? 'Request a new code.');
    }}><Field label="Sign-in code" name="code" spellCheck={false} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={pending} value={code} onChange={event => { entryIntent.codeDraft = event.target.value; setCode(event.target.value); }} />
    {error && <Status error>{error}</Status>}<Button type="submit" disabled={pending || !online}>{pending ? 'Checking…' : 'Sign in'}</Button></form>
    <Button variant="secondary" disabled={pending || !online || seconds > 0} onClick={async () => { if (!isOnline() || pending) return; const scope = beginScope(); setPending(true); const result = await requestEmailCode(entryIntent.email); if (!scope.isCurrent()) return; setPending(false); setNow(Date.now()); if (!result.ok) setError(result.error.message ?? 'Try again.'); }}>{seconds ? 'Resend code in ' + seconds + 's' : 'Resend code'}</Button><Link to="/sign-in">Use another email</Link></section>;
}
