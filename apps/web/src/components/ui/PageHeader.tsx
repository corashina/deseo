import type { ReactNode } from 'react';
export function PageHeader({ title, eyebrow, description, action }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
