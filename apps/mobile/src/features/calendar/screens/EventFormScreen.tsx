import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { DateTime } from 'luxon';
import { useRouter } from 'expo-router';
import { Alert, Switch, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { useDraft, type Draft } from '../../../lib/draft';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import { getDateIdea, ideaKeys, planDateIdea, type DateIdea } from '../date-ideas';
import { useCalendarSignals } from '../realtime';
import { createEvent, updateEvent } from '../commands';
import { calendarKeys, getEvent } from '../queries';
import { eventFormSchema, eventInputSchema, eventToForm, eventValuesSchema, toEventInput, wallTimeChoices } from '../schema';
import type { Event, EventFormValues, EventInput } from '../types';

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
  if (ideaId && idea.isPending) return <Screen title="Plan date"><Status message="Loading your idea…" /></Screen>;
  if (ideaId && idea.isError) return <Screen title="Plan date"><Status tone="error" message="We could not load this idea." actionLabel="Retry" onAction={() => { void idea.refetch(); }} /></Screen>;
  if (ideaId && !idea.data) return <Screen title="Plan date"><Status message="This idea is unavailable." /></Screen>;
  if (eventId && query.isPending) return <Screen title="Edit event"><Status message="Loading your event…" /></Screen>;
  if (eventId && query.isError) return <Screen title="Edit event"><Status tone="error" message="We could not load this event." actionLabel="Retry" onAction={() => { void query.refetch(); }} /></Screen>;
  if (eventId && !query.data) return <Screen title="Edit event"><Status message="This event is unavailable." /></Screen>;
  return <EventForm {...core} idea={ideaId ? idea.data! : undefined} reloadIdea={() => idea.refetch()} event={eventId ? query.data! : undefined} reload={() => query.refetch()} />;
}

function EventForm({ account, pair, online, event, idea, reload, reloadIdea }: ActiveProps & { event?: Event; idea?: DateIdea; reloadIdea: () => Promise<{ data?: DateIdea | null }>; reload: () => Promise<{ data?: Event | null }> }) {
  const router = useRouter();
  const slot = pair.members.find((member) => member.userId === account.id)!.slot;
  const [now] = useState(() => DateTime.now().setZone(account.timezone));
  const draft: Draft<EventFormValues, EventInput, Event> = useDraft<EventFormValues, EventInput, Event>({
    accountId: account.id, pairId: pair.pairId, key: idea ? `calendar:plan:${idea.id}` : `calendar:${event?.id ?? 'new'}`,
    values: eventValuesSchema, rules: eventFormSchema, input: eventInputSchema, online,
    initial: { id: event?.id, expectedVersion: idea?.version ?? event?.version, values: event ? eventToForm(event) : {
      title: idea?.title ?? '', allDay: false, repeat: 'none', importantDate: false, startDate: now.toISODate()!, endDate: now.plus({ hours: 1 }).toISODate()!,
      startTime: now.toFormat('HH:mm'), endTime: now.plus({ hours: 1 }).toFormat('HH:mm'),
      timezone: account.timezone, owner: 'together', visibility: 'shared', location: '', description: idea?.note ?? '',
    } },
    toInput: (values, identity) => toEventInput({ ...values, id: identity.id, pairId: pair.pairId }),
    command: (input, identity) => idea ? planDateIdea(idea.id, input, identity.expectedVersion!, identity.commandId)
      : event ? updateEvent(input.id, input, identity.expectedVersion!, identity.commandId) : createEvent(input, identity.commandId),
    // Planning conflicts on the idea version. The entered event values stay.
    reload: async () => {
      if (idea) { const saved = (await reloadIdea()).data; return saved ? { values: draft.form.getValues(), expectedVersion: saved.version } : null; }
      const saved = (await reload()).data; return saved ? { values: eventToForm(saved), expectedVersion: saved.version } : null;
    },
    onSaved: saved => router.replace({ pathname: '/events/[eventId]', params: { eventId: saved.id } }),
  });
  const { form, ready, saving, frozen, error, storageError } = draft;
  const values = form.watch();
  const isAuthor = !event || event.authorId === account.id;
  const locked = frozen || saving || !ready;
  const confirmShare = (input: EventInput) => event?.visibility === 'private' && input.visibility === 'shared'
    ? new Promise<EventInput | null>(resolve => Alert.alert('Share this event?', 'Your partner will see its title, dates, location, and description.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) }, { text: 'Share event', onPress: () => resolve({ ...input, confirmShared: true }) },
    ]))
    : input;
  const textField = (name: 'title' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'timezone' | 'location' | 'description', label: string, hint?: string) =>
    <Controller key={name} control={form.control} name={name} render={({ field, fieldState }) => <Field label={label} hint={hint} error={fieldState.error?.message}
      value={field.value} onChangeText={(text) => { field.onChange(text); if (name === 'startDate' && form.getValues('repeat') === 'yearly') form.setValue('endDate', text); if (name === 'startTime' || name === 'startDate') form.setValue('startOffset', undefined); if (name === 'endTime' || name === 'endDate') form.setValue('endOffset', undefined); if (name === 'timezone') { form.setValue('startOffset', undefined); form.setValue('endOffset', undefined); } }}
      onBlur={field.onBlur} editable={!locked} multiline={name === 'description'} autoCapitalize={name === 'timezone' ? 'none' : 'sentences'}
      maxLength={name === 'title' ? 120 : name === 'location' ? 200 : name === 'description' ? 2000 : undefined} /> } />;
  const offsets = (field: 'start' | 'end') => {
    let choices: DateTime[];
    try { choices = wallTimeChoices(values[`${field}Date`], values[`${field}Time`], values.timezone); } catch { return null; }
    if (choices.length < 2) return null;
    return <View style={ui.stack}>
      <Text style={theme.typography.body}>This {field} time occurs twice. Choose one.</Text>
      <View style={ui.row}>{choices.map((choice, index) => <Button key={choice.offset} label={`${index === 0 ? 'First' : 'Second'} · UTC${choice.toFormat('ZZ')}`}
        disabled={locked} variant={values[`${field}Offset`] === choice.offset ? 'primary' : 'secondary'}
        onPress={() => form.setValue(`${field}Offset`, choice.offset, { shouldValidate: true, shouldDirty: true })} />)}</View>
    </View>;
  };
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
    <Controller control={form.control} name="allDay" render={({ field }) => <View style={ui.row}><Text style={theme.typography.body}>All day</Text>
      <Switch accessibilityLabel="All day" value={field.value} disabled={locked} onValueChange={(value) => { field.onChange(value); if (!value) { form.setValue('repeat', 'none'); form.setValue('importantDate', false); } }} /></View>} />
    {values.allDay && !idea && <>
      <Controller control={form.control} name="importantDate" render={({ field }) => <View style={ui.row}><Text style={theme.typography.body}>Important date</Text><Switch accessibilityLabel="Important date" value={field.value === true} disabled={locked} onValueChange={value => { field.onChange(value); if (value) form.setValue('timezone', pair.timezone); else form.setValue('repeat', 'none'); }} /></View>} />
      {values.importantDate && <View style={ui.row}><Text style={theme.typography.body}>Repeat yearly</Text><Switch accessibilityLabel="Repeat yearly" value={values.repeat === 'yearly'} disabled={locked} onValueChange={value => { form.setValue('repeat', value ? 'yearly' : 'none'); if (value) form.setValue('endDate', form.getValues('startDate')); }} /></View>}
      {values.repeat === 'yearly' && <Status message="February 29 uses February 28 in non-leap years. Changes apply to the series." />}
    </>}
    {textField('startDate', 'Start date', 'Use YYYY-MM-DD.')}
    {!values.allDay && <>{textField('startTime', 'Start time', 'Use HH:mm, such as 18:30.')}{offsets('start')}</>}
    {textField('endDate', values.allDay ? 'Last included date' : 'End date', 'Use YYYY-MM-DD.')}
    {!values.allDay && <>{textField('endTime', 'End time', 'Use HH:mm, such as 19:30.')}{offsets('end')}</>}
    {textField('timezone', 'Timezone', 'Use an IANA name, such as Europe/Warsaw.')}
    <Text style={theme.typography.section}>Visibility</Text>
    <View style={ui.row}>{(['shared', 'private'] as const).map((visibility) => <Button key={visibility} label={visibility === 'shared' ? 'Shared' : 'Private'}
      disabled={locked || !isAuthor || !!idea} variant={values.visibility === visibility ? 'primary' : 'secondary'} onPress={() => {
        form.setValue('visibility', visibility, { shouldDirty: true });
        if (visibility === 'private') form.setValue('owner', slot, { shouldDirty: true });
      }} />)}</View>
    <Text style={theme.typography.secondary}>{values.visibility === 'private' ? 'Only you can see this event.' : 'Both partners can see this event.'}</Text>
    <Text style={theme.typography.section}>People</Text>
    <View style={ui.row}>{pair.members.map((member) => <Button key={member.slot} label={member.displayName} disabled={locked || (values.visibility === 'private' && member.slot !== slot)}
      variant={values.owner === member.slot ? 'primary' : 'secondary'} onPress={() => form.setValue('owner', member.slot, { shouldDirty: true })} />)}
      <Button label="Together" disabled={locked || values.visibility === 'private'} variant={values.owner === 'together' ? 'primary' : 'secondary'} onPress={() => form.setValue('owner', 'together', { shouldDirty: true })} />
    </View>
    {textField('location', 'Location (optional)')}
    {textField('description', 'Description (optional)')}
    <Button label={frozen ? 'Retry save' : event ? 'Save changes' : 'Save event'} loading={saving} disabled={saving || !ready || !online || error?.code === 'CONFLICT' || (idea !== undefined && error?.code === 'FORBIDDEN')}
      onPress={() => { void (frozen ? draft.retry() : draft.save(confirmShare)); }} />
    <Button label="Cancel" variant="secondary" disabled={saving || !ready} onPress={() => { void draft.leave().then(left => { if (left) router.back(); }); }} />
  </Screen>;
}
