import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { DateTime } from 'luxon';
import { useRouter } from 'expo-router';
import { Alert, Switch, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { DateTimeField } from '../../../components/ui/DateTimeField';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { useTheme } from '../../../theme';
import { useDraft, type Draft } from '../../../lib/draft';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import type { DateIdea } from '@deseo/domain/calendar';
import { getDateIdea, ideaKeys, planDateIdea } from '../date-ideas';
import { useCalendarSignals } from '../realtime';
import { createEvent, updateEvent } from '../commands';
import { calendarKeys, getEvent } from '../queries';
import { eventFormSchema, eventInputSchema, eventToForm, eventValuesSchema, toEventInput } from '@deseo/domain/calendar';
import type { Event, EventFormValues, EventInput } from '@deseo/domain/calendar';

type Core = ReturnType<typeof useCore>;
type ActiveProps = { account: Core['account']; pair: Extract<Core['pair'], { status: 'active' }>; online: boolean; refresh: Core['refresh'] };
export function EventFormScreen(props: { eventId?: string; ideaId?: string }) {
  return props.ideaId ? <CalendarAccess><CoreFormScreen {...props} /></CalendarAccess> : <CoreFormScreen {...props} />;
}
function CoreFormScreen({ eventId, ideaId }: { eventId?: string; ideaId?: string }) {
  const core = useCore();
  if (core.pair.status !== 'active') return <Screen title="Event"><Status message="Connect with your partner before you add an event." /></Screen>;
  return <FormEntry key={`${core.account.id}:${core.pair.pairId}:${eventId ?? ideaId ?? 'new'}`} eventId={eventId} ideaId={ideaId} account={core.account} pair={core.pair} online={core.online} refresh={core.refresh} />;
}

function FormEntry({ eventId, ideaId, ...core }: ActiveProps & { eventId?: string; ideaId?: string }) {
  const idea = useQuery({ queryKey: ideaKeys.detail(core.account.id, core.pair.pairId, ideaId ?? 'new'), queryFn: () => getDateIdea(core.pair.pairId, ideaId!), enabled: !!ideaId });
  useCalendarSignals(core.account.id, core.pair.pairId, core.refresh);
  const query = useQuery({ queryKey: calendarKeys.event(core.account.id, core.pair.pairId, eventId ?? 'new'),
    queryFn: () => getEvent(core.pair.pairId, eventId!), enabled: eventId !== undefined });
  if (ideaId && idea.isPending) return <Screen title="Plan date"><Status message="Loading idea…" /></Screen>;
  if (ideaId && idea.isError) return <Screen title="Plan date"><Status tone="error" message="We could not load this idea." actionLabel="Retry" onAction={() => { void idea.refetch(); }} /></Screen>;
  if (ideaId && !idea.data) return <Screen title="Plan date"><Status message="This idea is unavailable." /></Screen>;
  if (eventId && query.isPending) return <Screen title="Edit event"><Status message="Loading event…" /></Screen>;
  if (eventId && query.isError) return <Screen title="Edit event"><Status tone="error" message="We could not load this event." actionLabel="Retry" onAction={() => { void query.refetch(); }} /></Screen>;
  if (eventId && !query.data) return <Screen title="Edit event"><Status message="This event is unavailable." /></Screen>;
  return <EventForm {...core} idea={ideaId ? idea.data! : undefined} reloadIdea={() => idea.refetch()} event={eventId ? query.data! : undefined} reload={() => query.refetch()} />;
}

function EventForm({ account, pair, online, event, idea, reload, reloadIdea }: ActiveProps & { event?: Event; idea?: DateIdea; reloadIdea: () => Promise<{ data?: DateIdea | null }>; reload: () => Promise<{ data?: Event | null }> }) {
  const theme = useTheme();
  const router = useRouter();
  const [now] = useState(() => DateTime.now().setZone(account.timezone));
  const draft: Draft<EventFormValues, EventInput, Event> = useDraft<EventFormValues, EventInput, Event>({
    accountId: account.id, pairId: pair.pairId, key: idea ? `calendar:plan:${idea.id}` : `calendar:${event?.id ?? 'new'}`,
    values: eventValuesSchema, rules: eventFormSchema, input: eventInputSchema, online,
    initial: { id: event?.id, expectedVersion: idea?.version ?? event?.version, values: event ? eventToForm(event, account.timezone) : {
      title: idea?.title ?? '', allDay: false, repeat: 'none', importantDate: false, startDate: now.toISODate()!, endDate: now.plus({ hours: 1 }).toISODate()!,
      startTime: now.toFormat('HH:mm'), endTime: now.plus({ hours: 1 }).toFormat('HH:mm'),
      who: 'together', location: '', description: idea?.note ?? '',
    } },
    toInput: (values, identity) => toEventInput({ ...values, id: identity.id, pairId: pair.pairId }, account.timezone),
    command: (input, identity) => idea ? planDateIdea(idea.id, input, identity.expectedVersion!, identity.commandId)
      : event ? updateEvent(input.id, input, identity.expectedVersion!, identity.commandId) : createEvent(input, identity.commandId),
    // Planning conflicts on the idea version. The entered event values stay.
    reload: async () => {
      if (idea) { const saved = (await reloadIdea()).data; return saved ? { values: draft.form.getValues(), expectedVersion: saved.version } : null; }
      const saved = (await reload()).data; return saved ? { values: eventToForm(saved, account.timezone), expectedVersion: saved.version } : null;
    },
    onSaved: saved => router.replace({ pathname: '/events/[eventId]', params: { eventId: saved.id } }),
  });
  const { form, ready, saving, frozen, error, storageError } = draft;
  const values = form.watch();
  const isAuthor = !event || event.authorId === account.id;
  const locked = frozen || saving || !ready;
  const confirmShare = (input: EventInput) => event?.who === 'private' && input.who !== 'private'
    ? new Promise<EventInput | null>(resolve => Alert.alert('Share this event?', 'Your partner will see its title, dates, location, and description.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) }, { text: 'Share event', onPress: () => resolve({ ...input, confirmShared: true }) },
    ]))
    : input;
  // A yearly date keeps one day.
  const change = (name: 'startDate' | 'endDate' | 'startTime' | 'endTime', value: string) => {
    if (name === 'startDate' && form.getValues('repeat') === 'yearly') form.setValue('endDate', value);
  };
  const textField = (name: 'title' | 'location' | 'description', label: string) =>
    <Controller key={name} control={form.control} name={name} render={({ field, fieldState }) => <Field label={label} error={fieldState.error?.message}
      value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} editable={!locked} multiline={name === 'description'}
      maxLength={name === 'title' ? 120 : name === 'location' ? 200 : 2000} /> } />;
  const pickerField = (name: 'startDate' | 'endDate' | 'startTime' | 'endTime', label: string) =>
    <Controller key={name} control={form.control} name={name} render={({ field, fieldState }) => <DateTimeField label={label}
      mode={name.endsWith('Date') ? 'date' : 'time'} value={field.value} error={fieldState.error?.message} disabled={locked}
      onChange={value => { field.onChange(value); change(name, value); }} /> } />;
  if (draft.savedButNotCleared) { const savedId = draft.savedButNotCleared.id; return <Screen title="Event saved">
    <Status message="We saved your event. We could not remove its local draft." />
    <Button label="Open event" onPress={() => router.replace({ pathname: '/events/[eventId]', params: { eventId: savedId } })} />
  </Screen>; }
  return <Screen title={idea ? 'Plan date' : event ? 'Edit event' : 'Add event'}>
    {event?.repeat === 'yearly' && <Status message="Changes apply to the yearly series." />}
    {idea && <Status message="Save this shared event to mark your idea Planned." />}
    {!online && <Status message={draft.savedOnDevice ? 'You are offline. Your draft is on this device.' : 'You are offline. Keep this screen open until your draft saves.'} />}
    {storageError && <Status tone="error" message={storageError} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? `Your partner changed this ${idea ? 'idea' : 'event'}. Your draft is on this device.` : idea && error.code === 'FORBIDDEN' ? 'This planned event is unavailable. Reload the idea before you plan again.' : error.message ?? 'We could not save this event.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : idea && error.code === 'FORBIDDEN' ? 'Reload idea' : frozen ? 'Retry save' : undefined}
      onAction={error.code === 'CONFLICT' || (idea && error.code === 'FORBIDDEN') ? () => { void draft.reloadSaved(); } : frozen ? () => { void draft.retry(); } : undefined} />}
    {error?.code === 'CONFLICT' && <Button label="Return to draft" variant="secondary" onPress={draft.dismissConflict} />}
    {draft.canRestore && <Status message="Review the saved event. You can restore your draft before saving."
      actionLabel="Restore my draft" onAction={() => { void draft.restore(); }} />}
    {textField('title', 'Title')}
    <View style={theme.ui.stack}>
      <Text accessibilityRole="header" style={theme.typography.section}>Time</Text>
      <Controller control={form.control} name="allDay" render={({ field }) => <View style={theme.ui.row}><Text style={theme.typography.body}>All day</Text>
        <Switch accessibilityLabel="All day" value={field.value} disabled={locked} onValueChange={(value) => { field.onChange(value); if (!value) { form.setValue('repeat', 'none'); form.setValue('importantDate', false); } }} /></View>} />
      {values.allDay && !idea && <>
        <Controller control={form.control} name="importantDate" render={({ field }) => <View style={theme.ui.row}><Text style={theme.typography.body}>Important date</Text><Switch accessibilityLabel="Important date" value={field.value === true} disabled={locked} onValueChange={value => { field.onChange(value); if (!value) form.setValue('repeat', 'none'); }} /></View>} />
        {values.importantDate && <View style={theme.ui.row}><Text style={theme.typography.body}>Repeat yearly</Text><Switch accessibilityLabel="Repeat yearly" value={values.repeat === 'yearly'} disabled={locked} onValueChange={value => { form.setValue('repeat', value ? 'yearly' : 'none'); if (value) form.setValue('endDate', form.getValues('startDate')); }} /></View>}
        {values.repeat === 'yearly' && <Status message="February 29 uses February 28 in non-leap years. Changes apply to the series." />}
      </>}
      {pickerField('startDate', 'Start date')}
      {!values.allDay && <>{pickerField('startTime', 'Start time')}</>}
      {pickerField('endDate', values.allDay ? 'Last included date' : 'End date')}
      {!values.allDay && <>{pickerField('endTime', 'End time')}</>}
    </View>
    <View style={theme.ui.stack}>
      <Text accessibilityRole="header" style={theme.typography.section}>Sharing</Text>
      <View style={theme.ui.row}>{(['together', ...pair.members.map((member) => member.slot), 'private'] as const).map((who) => <Button key={who}
        label={who === 'together' ? 'Together' : who === 'private' ? 'Private' : pair.members.find((member) => member.slot === who)!.displayName}
        disabled={locked || (who === 'private' && (!isAuthor || !!idea))} variant={values.who === who ? 'primary' : 'secondary'}
        onPress={() => form.setValue('who', who, { shouldDirty: true })} />)}</View>
    </View>
    <View style={theme.ui.stack}>
      <Text accessibilityRole="header" style={theme.typography.section}>Details</Text>
      {textField('location', 'Location (optional)')}
      {textField('description', 'Description (optional)')}
    </View>
    <Button label={frozen ? 'Retry save' : event ? 'Save changes' : 'Save event'} loading={saving} disabled={saving || !ready || !online || error?.code === 'CONFLICT' || (idea !== undefined && error?.code === 'FORBIDDEN')}
      onPress={() => { void (frozen ? draft.retry() : draft.save(confirmShare)); }} />
    <Button label="Cancel" variant="secondary" disabled={saving || !ready} onPress={() => { void draft.leave().then(left => { if (left) router.back(); }); }} />
  </Screen>;
}
