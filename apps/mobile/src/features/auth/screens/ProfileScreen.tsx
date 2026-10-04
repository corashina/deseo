import { useState } from 'react';
import { getCalendars, getLocales } from 'expo-localization';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { saveProfile } from '../commands';
import { profileSchema } from '../schema';
import { useAuth } from '../session';

export function ProfileScreen() {
  const { refresh } = useAuth();
  const [error, setError] = useState<string>();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema), defaultValues: {
      displayName: '', timezone: getCalendars()[0]?.timeZone ?? 'UTC', locale: getLocales()[0]?.languageTag ?? 'en',
    },
  });
  const submit = handleSubmit(async input => {
    const result = await saveProfile(input);
    if (!result.ok) { setError(result.error.message ?? 'We could not save your profile. Try again.'); return; }
    await refresh(); router.replace('/');
  });
  return <Screen title="Your profile" subtitle="Your partner will see your name.">
    <Controller control={control} name="displayName" render={({ field }) => <Field label="Name" value={field.value}
      onChangeText={field.onChange} maxLength={40} error={errors.displayName?.message} autoComplete="given-name" />} />
    <Controller control={control} name="timezone" render={({ field }) => <Field label="Timezone" value={field.value}
      onChangeText={field.onChange} autoCapitalize="none" autoCorrect={false} hint="For example, Europe/Warsaw."
      error={errors.timezone?.message} />} />
    {error && <Status message={error} tone="error" />}
    <Button label="Save profile" loading={isSubmitting} onPress={() => { void submit(); }} />
  </Screen>;
}
