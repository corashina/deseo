import type { ReactNode } from 'react';
// A main screen hides its title, because the navigation names it. Screen readers still read it.
export function PageHeader({ title, eyebrow, description, action, hideTitle = false }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode; hideTitle?: boolean }) {
  const heading = <h1 className={hideTitle ? 'visually-hidden' : undefined}>{title}</h1>;
  if (hideTitle && !eyebrow && !description && !action) return heading;
  return <header className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{heading}{description && <p>{description}</p>}</div>{action}</header>;
}
