import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getPrivateStorage } from '../../../lib/private-storage';
import { toAppError } from '../../../lib/result';
import { requestEmailCode } from '../commands';
import { emailSchema } from '../schema';

export function EmailScreen() {
  const [error, setError] = useState<string>();
  const { control, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { email: '' } });
  const submit = handleSubmit(async ({ email }) => {
    setError(undefined);
    try {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) { setError('Enter a valid email address.'); return; }
      const result = await requestEmailCode(parsed.data);
      if (!result.ok) { setError(result.error.message ?? 'We could not send a code. Try again.'); return; }
      await (await getPrivateStorage()).setIntent('emailAttempt', JSON.stringify({ email: parsed.data, retryAt: result.data.retryAt }));
      router.push('/(auth)/verify');
    } catch (cause) { setError(toAppError(cause).message); }
  });
  return <Screen title="Your email" subtitle="We will send you a six-digit code.">
    <Controller control={control} name="email" render={({ field }) => <Field label="Email" value={field.value}
      onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="email-address" autoComplete="email"
      autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />} />
    {error && <Status message={error} tone="error" />}
    <Button label="Continue" loading={isSubmitting} onPress={() => { void submit(); }} />
  </Screen>;
}
