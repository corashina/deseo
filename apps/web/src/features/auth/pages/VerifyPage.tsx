import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { entryIntent, requestEmailCode, verifyEmailCode } from '..';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { PageHeader } from '../../../components/ui/PageHeader';
export function VerifyPage() {
  const [code, setCode] = useState(entryIntent.codeDraft);
  const [invalid, setInvalid] = useState(false);
  const [now, setNow] = useState(Date.now());
  const verify = useMutation({ mutationFn: (value: string) => verifyEmailCode(entryIntent.email, value) });
  const resend = useMutation({ mutationFn: () => requestEmailCode(entryIntent.email), onSuccess: () => setNow(Date.now()) });
  useUnsavedChanges(Boolean(code) && !verify.isSuccess);
  // An error moves focus to the code field, where the person fixes it.
  const form = useRef<HTMLFormElement>(null);
  const focusCode = () => form.current?.querySelector<HTMLInputElement>('input[name=code]')?.focus();
  useEffect(() => { if (verify.isError) focusCode(); }, [verify.isError]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!entryIntent.email) return <Navigate to="/sign-in" replace />;
  const pending = verify.isPending || resend.isPending;
  const codeError = invalid ? 'Enter the 6-digit code from your email.' : verify.isError ? toAppError(verify.error).message : '';
  const seconds = Math.max(0, Math.ceil((Date.parse(entryIntent.retryAt) - now) / 1000));
  return <section className="card form-page"><PageHeader title="Check your email" description={'Enter the code sent to ' + entryIntent.email + '.'} />
    <form ref={form} noValidate onSubmit={event => { event.preventDefault(); if (pending) return;
      const valid = /^\d{6}$/.test(code);
      setInvalid(!valid); if (valid) verify.mutate(code); else focusCode();
    }}><Field className="code-input" label="Sign-in code" hint="No email after a minute? Check your spam folder." name="code" spellCheck={false} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={pending} value={code} error={codeError} onChange={event => { entryIntent.codeDraft = event.target.value; setCode(event.target.value); }} />
    {resend.isError && <Status error>{toAppError(resend.error).message}</Status>}<Button variant="primary" type="submit" disabled={pending}>{verify.isPending ? 'Checking…' : 'Sign in'}</Button></form>
    <div className="actions"><Button variant="secondary" disabled={pending || seconds > 0} onClick={() => { verify.reset(); resend.mutate(); }}>{seconds ? 'Resend code in ' + seconds + 's' : 'Resend code'}</Button><Link to="/sign-in">Use another email</Link></div></section>;
}
