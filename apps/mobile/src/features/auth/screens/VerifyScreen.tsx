import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getPrivateStorage } from '../../../lib/private-storage';
import { toAppError } from '@deseo/domain/result';
import { requestEmailCode, verifyEmailCode } from '../commands';
import { useAuth } from '../session';

export function VerifyScreen() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void getPrivateStorage().then(storage => storage.getIntent('emailAttempt')).then(value => {
      if (!value) { router.replace('/(auth)/email'); return; }
      const attempt = JSON.parse(value) as { email: string; retryAt: string };
      setEmail(attempt.email); setRetryAt(Date.parse(attempt.retryAt));
    }).catch(cause => setError(toAppError(cause).message));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const submit = async () => {
    setBusy(true); setError(undefined);
    try {
      const result = await verifyEmailCode(email, code);
      if (!result.ok) { setError(result.error.message ?? 'The code is invalid or expired. Request a new code.'); return; }
      await (await getPrivateStorage()).removeIntent('emailAttempt');
      await refresh();
      router.replace('/');
    } catch (cause) { setError(toAppError(cause).message); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError(undefined);
    try {
      const result = await requestEmailCode(email);
      if (result.ok) {
        setRetryAt(Date.parse(result.data.retryAt));
        await (await getPrivateStorage()).setIntent('emailAttempt', JSON.stringify({ email, retryAt: result.data.retryAt }));
      } else setError(result.error.message ?? 'Wait before you request another code.');
    } catch (cause) { setError(toAppError(cause).message); }
    finally { setBusy(false); }
  };
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return <Screen title="Check your email" subtitle={email ? `Enter the code sent to ${email}. It expires after ten minutes.` : undefined}>
    <Field label="Sign-in code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code"
      textContentType="oneTimeCode" maxLength={6} returnKeyType="done" onSubmitEditing={() => { void submit(); }} />
    {error && <Status message={error} tone="error" />}
    <Button label="Sign in" loading={busy} disabled={code.length !== 6 || !email} onPress={() => { void submit(); }} />
    <Button label={remaining ? `Resend in ${remaining}s` : 'Resend code'} variant="secondary" disabled={remaining > 0 || busy || !email} onPress={() => { void resend(); }} />
    <Button label="Use another email" variant="text" onPress={() => router.replace('/(auth)/email')} />
  </Screen>;
}
