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
  const verify = useMutation({ mutationFn: (value: string) => verifyEmailCode(entryIntent.email, value) });
  const resend = useMutation({ mutationFn: () => requestEmailCode(entryIntent.email) });
  useUnsavedChanges(Boolean(code) && !verify.isSuccess);
  // An error moves focus to the code field, where the person fixes it.
  const form = useRef<HTMLFormElement>(null);
  const focusCode = () => form.current?.querySelector<HTMLInputElement>('input[name=code]')?.focus();
  useEffect(() => { if (verify.isError) focusCode(); }, [verify.isError]);
  if (!entryIntent.email) return <Navigate to="/sign-in" replace />;
  const pending = verify.isPending || resend.isPending;
  const codeError = invalid ? 'Enter the 6-digit code from your email.' : verify.isError ? toAppError(verify.error).message : '';
  return <section className="card form-page centered-card"><PageHeader title="Check your email" description={'Enter the code sent to ' + entryIntent.email + '.'} />
    <form ref={form} noValidate onSubmit={event => { event.preventDefault(); if (pending) return;
      const valid = /^\d{6}$/.test(code);
      setInvalid(!valid); if (valid) verify.mutate(code); else focusCode();
    }}><Field className="code-input" label="Sign-in code" hint="No email after a minute? Check your spam folder." name="code" spellCheck={false} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={pending} value={code} error={codeError} onChange={event => { entryIntent.codeDraft = event.target.value; setCode(event.target.value); }} />
    {resend.isError && <Status error>{toAppError(resend.error).message}</Status>}<Button variant="primary" type="submit" disabled={pending}>{verify.isPending ? 'Checking…' : 'Sign in'}</Button></form>
<<<<<<< HEAD
    <div className="actions"><Button variant="secondary" disabled={pending || seconds > 0} onClick={() => { verify.reset(); resend.mutate(); }}>{resend.isPending ? 'Sending…' : seconds ? 'Resend code in ' + seconds + 's' : 'Resend code'}</Button><Link to="/sign-in">Use another email</Link></div></section>;
=======
    <div className="actions"><ResendButton retryAt={entryIntent.retryAt} disabled={pending} onResend={() => { verify.reset(); resend.mutate(); }} /><Link to="/sign-in">Use another email</Link></div></section>;
}
const secondsUntil = (time: string) => Math.max(0, Math.ceil((Date.parse(time) - Date.now()) / 1000));
// The countdown ticks here, so the form does not render each second. The timer stops at zero.
// A new code gives a new retry time, which starts a new countdown.
function ResendButton({ retryAt, disabled, onResend }: { retryAt: string; disabled: boolean; onResend(): void }) {
  const [seconds, setSeconds] = useState(() => secondsUntil(retryAt));
  useEffect(() => {
    const tick = () => { const next = secondsUntil(retryAt); setSeconds(next); return next; };
    if (!tick()) return;
    const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  return <Button variant="secondary" disabled={disabled || seconds > 0} onClick={onResend}>{seconds ? 'Resend code in ' + seconds + 's' : 'Resend code'}</Button>;
>>>>>>> origin/master
}
