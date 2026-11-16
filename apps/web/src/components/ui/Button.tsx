import type { ButtonHTMLAttributes } from 'react';
// Choose the variant at each call. A page has one primary button.
export function Button({ className = '', variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant: 'primary' | 'secondary' | 'text' | 'danger' }) {
  return <button type="button" className={`button ${variant} ${className}`} {...props} />;
}
