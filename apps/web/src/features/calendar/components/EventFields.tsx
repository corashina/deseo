import { useEffect, useId, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { wallTimeChoices, type EventFormValues } from '@deseo/domain/calendar';
import { Field } from '../../../components/ui/Field';
import { TimezoneField } from '../../../components/ui/TimezoneField';
import type { OwnerNames } from './EventRow';

const timeFields = ['start', 'end'] as const;
export function EventFields({ form, names, slot, author, locked, planning = false }: {
  form: UseFormReturn<EventFormValues>; names: OwnerNames; slot: 'a' | 'b'; author: boolean; locked: boolean; planning?: boolean;
}) {
  const values = form.watch();
  const { register, formState: { errors } } = form;
  const prefix = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const detailErrors = Boolean(errors.importantDate || errors.repeat || errors.location || errors.description || errors.timezone);
  useEffect(() => { if (detailErrors && details.current) details.current.open = true; }, [detailErrors]);
  function error(name: keyof EventFormValues) { return errors[name]?.message; }
  function fieldProps(name: keyof EventFormValues, hint = false) {
    return { id: prefix + name, 'aria-invalid': Boolean(errors[name]),
      'aria-describedby': [hint && prefix + name + '-hint', errors[name] && prefix + name + '-error'].filter(Boolean).join(' ') || undefined };
  }
  function fieldError(name: keyof EventFormValues) {
    return error(name) && <span className="field-error" role="alert" id={prefix + name + '-error'}>{error(name)}</span>;
  }
  function clearOffset(which: 'start' | 'end') {
    form.setValue(`${which}Offset`, undefined);
    form.unregister(`${which}Offset`);
  }
  function offsetChoices(which: 'start' | 'end') {
    try { return wallTimeChoices(values[`${which}Date`], values[`${which}Time`], values.timezone); } catch { return []; }
  }
  const partner = slot === 'a' ? 'b' : 'a';
  // One choice sets both who the event is for and who can see it. Private events belong to their author.
  function choose(value: string) {
    const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted };
    form.setValue('visibility', value === 'private' ? 'private' : 'shared', options);
    form.setValue('owner', value === 'private' ? slot : value as EventFormValues['owner'], options);
  }
  // An important date is one all-day date. Only important dates repeat every year.
  function markImportant(checked: boolean) {
    if (checked) {
      form.setValue('allDay', true, { shouldDirty: true });
      form.setValue('endDate', form.getValues('startDate'), { shouldDirty: true });
      clearOffset('start'); clearOffset('end');
    } else form.setValue('repeat', 'none', { shouldDirty: true });
  }
  return <div className="event-fields"><fieldset disabled={locked}>
    <Field label="Title" {...register('title')} maxLength={120} required error={error('title')} />
    <section className="form-section" aria-labelledby={prefix + '-when'}>
      <h2 id={prefix + '-when'}>When</h2>
      <label className="checkbox-field"><input type="checkbox" {...register('allDay')} {...fieldProps('allDay')} />All day</label>
      {fieldError('allDay')}
      <div className="form-grid">
        <Field label="Start date" type="date" {...register('startDate', { onChange: () => clearOffset('start') })} required error={error('startDate')} />
        <Field label="End date" type="date" {...register('endDate', { onChange: () => clearOffset('end') })} required error={error('endDate')} />
      </div>
      {values.allDay ? <p className="muted">The end date is included.</p> : <div className="form-grid">{timeFields.map(which => {
        const choices = offsetChoices(which);
        return <div key={which}>
          <Field label={which === 'start' ? 'Start time' : 'End time'} type="time"
            {...register(`${which}Time`, { onChange: () => clearOffset(which) })} required error={error(`${which}Time`)} />
          {choices.length > 1 && <label className="field" htmlFor={prefix + which + 'Offset'}>
            <span id={prefix + which + 'Offset-label'}>{which === 'start' ? 'Start occurrence' : 'End occurrence'}</span>
            <select {...register(`${which}Offset`, { setValueAs: value => value === '' ? undefined : Number(value) })} {...fieldProps(`${which}Offset`)} aria-labelledby={prefix + which + 'Offset-label'}>
              <option value="">Choose an occurrence</option>
              {choices.map((choice, index) => <option key={choice.offset} value={choice.offset}>{index === 0 ? 'First' : 'Second'} occurrence (UTC{choice.toFormat('ZZ')})</option>)}
            </select>{fieldError(`${which}Offset`)}
          </label>}
        </div>;
      })}</div>}
    </section>
    <label className="field" htmlFor={prefix + 'who'}><span id={prefix + 'who-label'}>Who</span>
      <select id={prefix + 'who'} name="who" aria-labelledby={prefix + 'who-label'} aria-invalid={Boolean(errors.owner || errors.visibility)}
        aria-describedby={errors.owner || errors.visibility ? prefix + 'who-error' : undefined}
        value={values.visibility === 'private' ? 'private' : values.owner} onChange={event => choose(event.target.value)}>
        <option value="together">Together</option>
        <option value={slot}>Me</option>
        <option value={partner}>{names[partner]}</option>
        {(author && !planning || values.visibility === 'private') && <option value="private">Private (just me)</option>}
      </select>
      {(errors.owner || errors.visibility) && <span className="field-error" role="alert" id={prefix + 'who-error'}>{errors.owner?.message ?? errors.visibility?.message}</span>}
    </label>
    <details className="event-details" ref={details} open={Boolean(values.location || values.description || values.importantDate || values.repeat === 'yearly') || undefined}>
      <summary>More details</summary>
      <div className="event-details-content">
        <TimezoneField {...register('timezone', { onChange: () => { clearOffset('start'); clearOffset('end'); } })} required error={error('timezone')} />
        <label className="checkbox-field"><input type="checkbox" {...register('importantDate', { onChange: event => markImportant(event.target.checked) })} {...fieldProps('importantDate', true)} />Important date</label>
        <p className="field-hint" id={prefix + 'importantDate-hint'}>Show a countdown on Today. An important date is one whole day.</p>{fieldError('importantDate')}
        {values.importantDate && !planning && <><label className="checkbox-field"><input type="checkbox" name="repeatYearly" {...fieldProps('repeat')} checked={values.repeat === 'yearly'} onChange={event => form.setValue('repeat', event.target.checked ? 'yearly' : 'none', { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} />Repeat every year</label>{fieldError('repeat')}</>}
        <Field label="Location" {...register('location')} maxLength={200} error={error('location')} />
        <label className="field" htmlFor={prefix + 'description'}><span id={prefix + 'description-label'}>Description</span><textarea autoComplete="off" {...register('description')} {...fieldProps('description')} aria-labelledby={prefix + 'description-label'} maxLength={2000} rows={4} />{fieldError('description')}</label>
      </div>
    </details>
  </fieldset></div>;
}
