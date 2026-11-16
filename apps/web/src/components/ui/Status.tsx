import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
export function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div className={error ? 'status error' : 'status'} role={error ? 'alert' : 'status'}>{error && <WarningCircleIcon size={20} aria-hidden="true" />}<div>{children}</div></div>;
}
