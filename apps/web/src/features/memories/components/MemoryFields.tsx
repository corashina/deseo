import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { MemoryInput } from '@deseo/domain/memories';
import { Field } from '../../../components/ui/Field';
// The date and caption of a memory. Each error shows below its field.
export function MemoryFields({ form }: { form: UseFormReturn<MemoryInput> }) {
  const captionId = useId();
  const { errors } = form.formState;
  return <>
    <Field label="Memory date" type="date" required {...form.register('memoryDate')} error={errors.memoryDate?.message} />
    <label className="field" htmlFor={captionId}><span>Caption</span><textarea id={captionId} rows={4} maxLength={1000} autoComplete="off" {...form.register('caption')} aria-invalid={errors.caption ? true : undefined} aria-describedby={errors.caption ? captionId + '-error' : undefined} />
      {errors.caption && <span className="field-error" role="alert" id={captionId + '-error'}>{errors.caption.message}</span>}</label>
  </>;
}
