import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
export function PageHeader({ title, description, action, back }: { title: string; description?: string; action?: ReactNode; back?: { to: string; label: string } }) {
  return <header className="page-header"><div>{back && <Link className="back-link" to={back.to}>‹ {back.label}</Link>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
