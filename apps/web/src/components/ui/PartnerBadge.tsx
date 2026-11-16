import type { Owner } from '@deseo/domain/calendar';

// An owner's name in its stable owner color.
export function PartnerBadge({ name, slot }: { name: string; slot: Owner }) {
  return <span className={`partner-badge slot-${slot}`}>{name}</span>;
}
