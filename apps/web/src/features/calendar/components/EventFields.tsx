import { useEffect, useId, useRef } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { EventFormValues } from '@deseo/domain/calendar';
import { Field } from '../../../components/ui/Field';
import type { OwnerNames } from './EventRow';

export function EventFields({ form, names, slot, author, locked, planning = false }: {
  form: UseFormReturn<EventFormValues>; names: OwnerNames; slot: 'a' | 'b'; author: boolean; locked: boolean; planning?: boolean;
}) {
  // Read only the values these fields use. Typing a title, a date, or a description then does not render them again.
  const values = useWatch({ control: form.control, compute: ({ allDay, who, importantDate, repeat, location, description }) =>
    ({ allDay, who, importantDate, repeat, details: Boolean(location || description) }) });
  const { register, formState: { errors } } = form;
  const prefix = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const detailErrors = Boolean(errors.importantDate || errors.repeat || errors.location || errors.description);
  useEffect(() => { if (detailErrors && details.current) details.current.open = true; }, [detailErrors]);
  function error(name: keyof EventFormValues) { return errors[name]?.message; }
  function fieldProps(name: keyof EventFormValues, hint = false) {
    return { id: prefix + name, 'aria-invalid': Boolean(errors[name]),
      'aria-describedby': [hint && prefix + name + '-hint', errors[name] && prefix + name + '-error'].filter(Boolean).join(' ') || undefined };
  }
  function fieldError(name: keyof EventFormValues) {
    return error(name) && <span className="field-error" role="alert" id={prefix + name + '-error'}>{error(name)}</span>;
  }
  const partner = slot === 'a' ? 'b' : 'a';
  // An important date is one all-day date. Only important dates repeat every year.
  function markImportant(checked: boolean) {
    if (checked) {
      form.setValue('allDay', true, { shouldDirty: true });
      form.setValue('endDate', form.getValues('startDate'), { shouldDirty: true });
    } else form.setValue('repeat', 'none', { shouldDirty: true });
  }
  return <div className="event-fields"><fieldset disabled={locked}>
    <Field label="Title" {...register('title')} maxLength={120} required error={error('title')} />
    <section className="form-section" aria-labelledby={prefix + '-when'}>
      <h2 id={prefix + '-when'}>When</h2>
      <label className="checkbox-field"><input type="checkbox" {...register('allDay')} {...fieldProps('allDay')} />All day</label>
      {fieldError('allDay')}
      <div className="form-grid">
        <Field label="Start date" type="date" {...register('startDate')} required error={error('startDate')} />
        <Field label="End date" type="date" {...register('endDate')} required error={error('endDate')} />
      </div>
      {values.allDay ? <p className="muted">The end date is included.</p> : <div className="form-grid">
        <Field label="Start time" type="time" {...register('startTime')} required error={error('startTime')} />
        <Field label="End time" type="time" {...register('endTime')} required error={error('endTime')} />
      </div>}
    </section>
    <label className="field" htmlFor={prefix + 'who'}><span id={prefix + 'who-label'}>Who</span>
      <select id={prefix + 'who'} aria-labelledby={prefix + 'who-label'} aria-invalid={Boolean(errors.who)}
        aria-describedby={errors.who ? prefix + 'who-error' : undefined} {...register('who')}>
        <option value="together">Together</option>
        <option value={slot}>Me</option>
        <option value={partner}>{names[partner]}</option>
        {(author && !planning || values.who === 'private') && <option value="private">Private (just me)</option>}
      </select>
      {errors.who && <span className="field-error" role="alert" id={prefix + 'who-error'}>{errors.who.message}</span>}
    </label>
    <details className="event-details" ref={details} open={Boolean(values.details || values.importantDate || values.repeat === 'yearly') || undefined}>
      <summary>More details</summary>
      <div className="event-details-content">
        <label className="checkbox-field"><input type="checkbox" {...register('importantDate', { onChange: event => markImportant(event.target.checked) })} {...fieldProps('importantDate', true)} />Important date</label>
        <p className="field-hint" id={prefix + 'importantDate-hint'}>Show a countdown on Today. An important date is one whole day.</p>{fieldError('importantDate')}
        {values.importantDate && !planning && <><label className="checkbox-field"><input type="checkbox" name="repeatYearly" {...fieldProps('repeat')} checked={values.repeat === 'yearly'} onChange={event => form.setValue('repeat', event.target.checked ? 'yearly' : 'none', { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} />Repeat every year</label>{fieldError('repeat')}</>}
        <Field label="Location" {...register('location')} maxLength={200} error={error('location')} />
        <label className="field" htmlFor={prefix + 'description'}><span id={prefix + 'description-label'}>Description</span><textarea autoComplete="off" {...register('description')} {...fieldProps('description')} aria-labelledby={prefix + 'description-label'} maxLength={2000} rows={4} />{fieldError('description')}</label>
      </div>
    </details>
  </fieldset></div>;
}
