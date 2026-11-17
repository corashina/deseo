import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Memory } from '@deseo/domain/memories';
import type { PairMember } from '@deseo/domain/pair';
import { PartnerBadge } from '../../../components/ui/PartnerBadge';
import { MemoryImage } from './MemoryImage';
import { formatDate } from '../../../lib/format';
export function MemoryCard({ memory, author, locale }: { memory: Memory; author: PairMember | undefined; locale: string }) {
  const photos = memory.photos.length + (memory.photos.length === 1 ? ' photo' : ' photos');
  return <article className="card memory-card">
    <div className="memory-cover"><MemoryImage photo={memory.photos[0]} alt="" /></div>
    <Link to={'/memories/' + memory.id} className="memory-card-link memory-card-copy">{memory.caption && <h3>{memory.caption}</h3>}
      <p className="memory-meta">{author && <PartnerBadge name={author.displayName} slot={author.slot} />}<span>{formatDate(DateTime.fromISO(memory.memoryDate), 'date', locale)} · {photos}</span></p></Link>
  </article>;
}
