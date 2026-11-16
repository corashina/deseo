// A partner's name in their stable owner color.
export function PartnerBadge({ name, slot }: { name: string; slot: 'a' | 'b' }) {
  return <span className={`partner-badge slot-${slot}`}>{name}</span>;
}
