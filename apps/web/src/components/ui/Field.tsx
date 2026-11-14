import { useId, type InputHTMLAttributes } from 'react';
export function Field({ label, hint, error, autoComplete = 'off', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const describedBy = [props['aria-describedby'], hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ') || undefined;
  return <label className="field" htmlFor={id}>
    <span id={id + '-label'}>{label}</span>
    <input {...props} autoComplete={autoComplete} id={id} aria-labelledby={props['aria-labelledby'] ?? id + '-label'} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy} />
    {hint && <span className="field-hint" id={id + '-hint'}>{hint}</span>}
    {error && <span className="field-error" role="alert" id={id + '-error'}>{error}</span>}
  </label>;
}
