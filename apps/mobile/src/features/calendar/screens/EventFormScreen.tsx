import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { DateTime } from 'luxon';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { Alert, Switch, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { captureQueryScope } from '../../../lib/query-client';
import { registerDraftFlush } from '../../../lib/draft-lifecycle';
import type { CommandError } from '@deseo/domain/result';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import { type DateIdea } from '@deseo/domain/calendar';
import { getDateIdea, ideaKeys, planDateIdea } from '../date-ideas';
import { useCalendarSignals } from '../realtime';
import { createEvent, updateEvent } from '../commands';
import { readEventDraft, removeEventDraft, writeEventDraft } from '../drafts';
import { calendarKeys, getEvent } from '../queries';
import { eventFormSchema, eventToForm, toEventInput, wallTimeChoices } from '@deseo/domain/calendar';
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
  const draftKey = idea ? `calendar:idea-plan:${idea.id}` : `calendar:${event?.id ?? 'new'}`;
  const sourceIdea = useRef(idea ? { id: idea.id, version: idea.version } : undefined);
  const now = useRef(DateTime.now().setZone(account.timezone));
  const [initialIdentity] = useState(() => ({ id: event?.id ?? randomUUID(), commandId: randomUUID(), expectedVersion: event?.version }));
  const identity = useRef(initialIdentity);
  const pending = useRef(false);
  const complete = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submission = useRef<EventInput | undefined>(undefined);
  const preserved = useRef<EventFormValues | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [canRestore, setCanRestore] = useState(false);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const form = useForm<EventFormValues>({ resolver: zodResolver(eventFormSchema), defaultValues: event ? eventToForm(event) : {
    title: idea?.title ?? '', allDay: false, repeat: 'none', importantDate: false, startDate: now.current.toISODate()!, endDate: now.current.plus({ hours: 1 }).toISODate()!,
    startTime: now.current.toFormat('HH:mm'), endTime: now.current.plus({ hours: 1 }).toFormat('HH:mm'),
    timezone: account.timezone, owner: 'together', visibility: 'shared', location: '', description: idea?.note ?? '',
  } });
  const values = form.watch();
  const isAuthor = !event || event.authorId === account.id;
  const locked = frozen || saving || !ready;

  const persist = async (draftValues: EventFormValues) => {
    await writeEventDraft(account.id, pair.pairId, draftKey, { ...identity.current, values: draftValues, submission: submission.current, sourceIdea: sourceIdea.current, preservedValues: preserved.current });
    setSavedDraft(true); setStorageError(null);
  };
  useEffect(() => {
    let active = true;
    const scope = captureQueryScope();
    void readEventDraft(account.id, pair.pairId, draftKey).then((draft) => {
      scope.assertCurrent();
      if (!active) return;
      if (draft) {
        if (event && draft.id !== event.id) throw new Error('The draft belongs to another event.');
        if (event && draft.expectedVersion === undefined) throw new Error('The draft has no edit version.');
        if (idea && draft.sourceIdea?.id !== idea.id) throw new Error('The draft belongs to another idea.');
        sourceIdea.current = draft.sourceIdea; preserved.current = draft.preservedValues; setCanRestore(draft.preservedValues !== undefined);
        identity.current = { id: draft.id, commandId: draft.commandId, expectedVersion: draft.expectedVersion };
        submission.current = draft.submission;
        form.reset(draft.values);
        setSavedDraft(true); setFrozen(draft.submission !== undefined);
        if (draft.submission) setError({ code: 'RETRYABLE', message: 'Confirm this save before you change the draft.' });
      }
      setReady(true);
    }).catch(() => { if (active) setStorageError('We could not open your draft. Restore private storage before you edit this event.'); });
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, [account.id, pair.pairId, draftKey, form.reset]);

  useEffect(() => {
    if (!ready) return;
    const scope = captureQueryScope();
    const removeFlush = registerDraftFlush(async () => {
      if (complete.current) return;
      scope.assertCurrent();
      if (timer.current) clearTimeout(timer.current);
      await writeEventDraft(account.id, pair.pairId, draftKey, { ...identity.current, values: form.getValues(), submission: submission.current, sourceIdea: sourceIdea.current, preservedValues: preserved.current });
    });
    const listener = form.watch(() => {
      if (complete.current || submission.current) return;
      setSavedDraft(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try { scope.assertCurrent(); } catch { return; }
        void persist(form.getValues()).catch(() => setStorageError('We could not save your draft on this device. Keep this screen open.'));
      }, 400);
    });
    return () => {
      removeFlush();
      listener.unsubscribe(); if (timer.current) clearTimeout(timer.current);
      if (complete.current) return;
      try { scope.assertCurrent(); } catch { return; }
      void writeEventDraft(account.id, pair.pairId, draftKey, { ...identity.current, values: form.getValues(), submission: submission.current, sourceIdea: sourceIdea.current, preservedValues: preserved.current }).catch(() => undefined);
    };
  }, [ready, account.id, pair.pairId, draftKey, form.watch]);

  const submit = async (input: EventInput) => {
    if (pending.current || !online || !ready || complete.current) return;
    const scope = captureQueryScope();
    pending.current = true; setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    submission.current = input; setFrozen(true);
    try {
      await persist(form.getValues());
      scope.assertCurrent();
      const result = sourceIdea.current
        ? await planDateIdea(sourceIdea.current.id, input, sourceIdea.current.version, identity.current.commandId)
        : event
        ? await updateEvent(input.id, input, identity.current.expectedVersion!, identity.current.commandId)
        : await createEvent(input, identity.current.commandId);
      scope.assertCurrent();
      if (result.ok) {
        complete.current = true;
        try { await removeEventDraft(account.id, pair.pairId, draftKey); }
        catch { setStorageError('We saved your event. We could not remove its local draft.'); setCompletedId(result.data.id); return; }
        scope.assertCurrent();
        router.replace({ pathname: '/events/[eventId]', params: { eventId: result.data.id } });
      } else {
        setError(result.error);
        if (result.error.code !== 'RETRYABLE') {
          submission.current = undefined; setFrozen(false); identity.current.commandId = randomUUID();
          await persist(form.getValues());
        }
      }
    } catch {
      try { scope.assertCurrent(); } catch { return; }
      setStorageError('We could not save your draft on this device. Keep this screen open.');
    } finally {
      pending.current = false;
      try { scope.assertCurrent(); setSaving(false); } catch { /* The account screen owns recovery. */ }
    }
  };
  const save = (draftValues: EventFormValues) => {
    const input = toEventInput({ ...draftValues, id: identity.current.id, pairId: pair.pairId });
    if (event?.visibility === 'private' && input.visibility === 'shared') {
      Alert.alert('Share this event?', 'Your partner will see its title, dates, location, and description.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Share event', onPress: () => { void submit({ ...input, confirmShared: true }); } },
      ]);
    } else void submit(input);
  };
  const reloadSaved = async () => {
    const scope = captureQueryScope();
    preserved.current = form.getValues();
    const result = idea ? await reloadIdea() : await reload();
    try { scope.assertCurrent(); } catch { return; }
    if (!result.data) { setError({ code: 'FORBIDDEN', message: 'This event is unavailable.' }); return; }
    if (idea) sourceIdea.current = { id: idea.id, version: result.data.version };
    else identity.current.expectedVersion = result.data.version;
    identity.current.commandId = randomUUID(); submission.current = undefined;
    if (!idea) form.reset(eventToForm(result.data as Event)); setError(null); setFrozen(false); setCanRestore(true);
    void persist(form.getValues()).catch(() => setStorageError('We could not save your draft on this device.'));
  };
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
  if (completedId) return <Screen title="Event saved">
    <Status message={storageError ?? 'We saved your event.'} />
    <Button label="Open event" onPress={() => router.replace({ pathname: '/events/[eventId]', params: { eventId: completedId } })} />
  </Screen>;
  return <Screen title={idea ? 'Plan date' : event ? 'Edit event' : 'Add event'}>
    {event?.repeat === 'yearly' && <Status message="Changes apply to the yearly series." />}
    {idea && <Status message="Save this shared event to mark your idea Planned." />}
    {!online && <Status message={savedDraft ? 'You are offline. Your draft is on this device.' : 'You are offline. Keep this screen open until your draft saves.'} />}
    {storageError && <Status tone="error" message={storageError} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? `Your partner changed this ${idea ? 'idea' : 'event'}. Your draft is on this device.` : idea && error.code === 'FORBIDDEN' ? 'This planned event is unavailable. Reload the idea before you plan again.' : error.message ?? 'We could not save this event.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : idea && error.code === 'FORBIDDEN' ? 'Reload idea' : frozen ? 'Retry save' : undefined}
      onAction={error.code === 'CONFLICT' || (idea && error.code === 'FORBIDDEN') ? () => { void reloadSaved(); } : frozen ? () => { if (submission.current && online) void submit(submission.current); } : undefined} />}
    {error?.code === 'CONFLICT' && <Button label="Return to draft" variant="secondary" onPress={() => setError(null)} />}
    {canRestore && <Status message="Review the saved event. You can restore your draft before saving."
      actionLabel="Restore my draft" onAction={() => { if (preserved.current) form.reset(preserved.current); preserved.current = undefined; setCanRestore(false); void persist(form.getValues()).catch(() => setStorageError('We could not save your draft on this device.')); }} />}
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
    <Button label={frozen ? 'Retry save' : event ? 'Save changes' : 'Save event'} loading={saving} disabled={saving || !ready || !online || complete.current || error?.code === 'CONFLICT' || (idea !== undefined && error?.code === 'FORBIDDEN')}
      onPress={frozen ? () => { if (submission.current) void submit(submission.current); } : () => { void form.handleSubmit(save)(); }} />
    <Button label="Cancel" variant="secondary" disabled={saving || !ready} onPress={() => {
      if (timer.current) clearTimeout(timer.current);
      const scope = captureQueryScope();
      void persist(form.getValues()).then(() => { scope.assertCurrent(); router.back(); }).catch(() => setStorageError('We could not save your draft. Keep this screen open.'));
    }} />
  </Screen>;
}
