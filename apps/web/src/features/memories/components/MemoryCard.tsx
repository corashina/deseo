import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Memory } from '@deseo/domain/memories';
import { MemoryImage } from './MemoryImage';
import { formatDate } from '../../../lib/format';
export function MemoryCard({ memory, author, locale }: { memory: Memory; author: string; locale: string }) {
  return <article className="card memory-card">
    <div className="memory-cover"><MemoryImage photoId={memory.photos[0].id} alt={memory.caption || 'Shared memory'} /></div>
    <Link to={'/memories/' + memory.id} className="memory-card-link memory-card-copy"><h3>{memory.caption || 'Our memory'}</h3><p>{formatDate(DateTime.fromISO(memory.memoryDate), 'date', locale)} · {author}</p><span>{memory.photos.length} {memory.photos.length === 1 ? 'photo' : 'photos'}</span></Link>
  </article>;
}
