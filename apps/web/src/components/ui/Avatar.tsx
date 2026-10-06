export function Avatar({ name, slot = 'a' }: { name: string; slot?: 'a' | 'b' }) {
  return <span aria-hidden="true" className={`avatar slot-${slot}`}>{name.trim().slice(0, 1).toUpperCase()}</span>;
}
