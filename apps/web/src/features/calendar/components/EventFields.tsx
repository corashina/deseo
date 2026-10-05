import type { UseFormReturn } from 'react-hook-form';
import { wallTimeChoices, type EventFormValues } from '@deseo/domain/calendar';
import type { OwnerNames } from './EventRow';
export function EventFields({ form, names, slot, author, locked }: { form: UseFormReturn<EventFormValues>; names: OwnerNames; slot: 'a'|'b'; author: boolean; locked: boolean }) {
  const values = form.watch(); const { register, formState: { errors } } = form;
  function clearOffset(which: 'start'|'end') {
    // Clear the live selector before unregister removes its reference and default.
    form.setValue(`${which}Offset`, undefined);
    form.unregister(`${which}Offset`);
  }
  const offsetChoices = (which: 'start'|'end') => {
    try { return wallTimeChoices(values[`${which}Date`], values[`${which}Time`], values.timezone); } catch { return []; }
  };
  return <div className="event-fields"><fieldset disabled={locked}><label className="field"><span>Title</span><input {...register('title')} maxLength={120} required /></label>
    <label className="checkbox-field"><input type="checkbox" {...register('allDay')} />All day</label>
    <div className="form-grid">
      <label className="field">
        <span>Start date</span>
        <input type="date" {...register('startDate', { onChange: () => clearOffset('start') })} required />
      </label>
      <label className="field">
        <span>End date</span>
        <input type="date" {...register('endDate', { onChange: () => clearOffset('end') })} required />
      </label>
    </div>
    {values.allDay ? <p className="muted">The end date is included.</p> : <div className="form-grid">{(['start', 'end'] as const).map(which => {
      const choices = offsetChoices(which);
      return <div key={which}><label className="field"><span>{which === 'start' ? 'Start time' : 'End time'}</span><input type="time" {...register(`${which}Time`, { onChange: () => clearOffset(which) })} required /></label>{choices.length > 1 && <label className="field"><span>{which === 'start' ? 'Start occurrence' : 'End occurrence'}</span><select {...register(`${which}Offset`, { setValueAs: value => value === '' ? undefined : Number(value) })}><option value="">Choose an occurrence</option>{choices.map((choice,i) => <option key={choice.offset} value={choice.offset}>{i === 0 ? 'First' : 'Second'} occurrence (UTC{choice.toFormat('ZZ')})</option>)}</select></label>}</div>;
    })}</div>}
    <label className="field"><span>Timezone</span><input {...register('timezone', { onChange: () => { clearOffset('start'); clearOffset('end'); } })} required /></label>
    <div className="form-grid"><label className="field"><span>Owner</span><select {...register('owner')}>{(['a','b','together'] as const).filter(owner => values.visibility !== 'private' || owner === slot).map(owner => <option value={owner} key={owner}>{names[owner]}</option>)}</select></label><label className="field"><span>Visibility</span><select {...register('visibility', { onChange: event => { if (event.target.value === 'private') form.setValue('owner', slot); } })} disabled={!author}><option value="shared">Shared with your partner</option><option value="private">Private to you</option></select></label></div>
    <label className="checkbox-field"><input type="checkbox" {...register('importantDate')} />Important date</label>
    <label className="field"><span>Repeat</span><select {...register('repeat')}><option value="none">Does not repeat</option><option value="yearly">Every year</option></select></label>
    <label className="field"><span>Location</span><input {...register('location')} maxLength={200} /></label><label className="field"><span>Description</span><textarea {...register('description')} maxLength={2000} rows={4} /></label>
    {Object.entries(errors).map(([field,error]) => <p role="alert" key={field}>{error.message}</p>)}
  </fieldset></div>;
}
