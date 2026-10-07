import { useEffect, useId, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { wallTimeChoices, type EventFormValues } from '@deseo/domain/calendar';
import { Field } from '../../../components/ui/Field';
import { TimezoneField } from '../../../components/ui/TimezoneField';
import type { OwnerNames } from './EventRow';

const timeFields = ['start', 'end'] as const;
const owners = ['a', 'b', 'together'] as const;
export function EventFields({ form, names, slot, author, locked, planning = false }: {
  form: UseFormReturn<EventFormValues>; names: OwnerNames; slot: 'a' | 'b'; author: boolean; locked: boolean; planning?: boolean;
}) {
  const values = form.watch();
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
  function clearOffset(which: 'start' | 'end') {
    form.setValue(`${which}Offset`, undefined);
    form.unregister(`${which}Offset`);
  }
  function offsetChoices(which: 'start' | 'end') {
    try { return wallTimeChoices(values[`${which}Date`], values[`${which}Time`], values.timezone); } catch { return []; }
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
      <TimezoneField {...register('timezone', { onChange: () => { clearOffset('start'); clearOffset('end'); } })} required error={error('timezone')} />
    </section>
    <section className="form-section" aria-labelledby={prefix + '-sharing'}>
      <h2 id={prefix + '-sharing'}>Sharing</h2>
      <div className="form-grid">
        <label className="field" htmlFor={prefix + 'owner'}><span id={prefix + 'owner-label'}>Owner</span>
          <select {...register('owner')} {...fieldProps('owner')} aria-labelledby={prefix + 'owner-label'}>{owners.filter(owner => values.visibility !== 'private' || owner === slot).map(owner => <option value={owner} key={owner}>{names[owner]}</option>)}</select>{fieldError('owner')}
        </label>
        <label className="field" htmlFor={prefix + 'visibility'}><span id={prefix + 'visibility-label'}>Visibility</span>
          <select {...register('visibility', { onChange: event => { if (event.target.value === 'private') form.setValue('owner', slot); } })} {...fieldProps('visibility')} aria-labelledby={prefix + 'visibility-label'} disabled={!author || planning}>
            <option value="shared">Shared with your partner</option><option value="private">Private to you</option>
          </select>{fieldError('visibility')}
        </label>
      </div>
    </section>
    <details className="event-details" ref={details} open={Boolean(values.location || values.description || values.importantDate || values.repeat === 'yearly') || undefined}>
      <summary>More details</summary>
      <div className="event-details-content">
        <label className="checkbox-field"><input type="checkbox" {...register('importantDate')} {...fieldProps('importantDate', true)} />Important date</label>
        <p className="field-hint" id={prefix + 'importantDate-hint'}>Show this date on Today. Choose a one-day, all-day event.</p>{fieldError('importantDate')}
        <label className="field" htmlFor={prefix + 'repeat'}><span id={prefix + 'repeat-label'}>Repeat</span>
          <select {...register('repeat')} {...fieldProps('repeat', true)} aria-labelledby={prefix + 'repeat-label'} disabled={planning}><option value="none">Does not repeat</option><option value="yearly">Every year</option></select>
          <span className="field-hint" id={prefix + 'repeat-hint'}>Yearly dates require a one-day, all-day event.</span>{fieldError('repeat')}
        </label>
        <Field label="Location" {...register('location')} maxLength={200} error={error('location')} />
        <label className="field" htmlFor={prefix + 'description'}><span id={prefix + 'description-label'}>Description</span><textarea {...register('description')} {...fieldProps('description')} aria-labelledby={prefix + 'description-label'} maxLength={2000} rows={4} />{fieldError('description')}</label>
      </div>
    </details>
  </fieldset></div>;
}
