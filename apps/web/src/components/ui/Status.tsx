export function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={error ? 'status error' : 'status'} role={error ? 'alert' : 'status'}>{children}</p>;
}
