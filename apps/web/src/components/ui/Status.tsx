export function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div className={error ? 'status error' : 'status'} role={error ? 'alert' : 'status'}>{children}</div>;
}
