import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import type { Memory } from '@deseo/domain/memories';
import { MemoryImage } from './MemoryImage';
export function MemoryCard({ memory, author }: { memory: Memory; author: string }) {
  return <article className="card memory-card">
    <div className="memory-cover"><MemoryImage path={memory.photos[0].thumbPath} alt={memory.caption || 'Shared memory'} /></div>
    <Link to={'/memories/' + memory.id} className="memory-card-link memory-card-copy"><h3>{memory.caption || 'Our memory'}</h3><p>{DateTime.fromISO(memory.memoryDate).setLocale('en').toFormat('d LLLL yyyy')} · {author}</p><span>{memory.photos.length} {memory.photos.length === 1 ? 'photo' : 'photos'}</span></Link>
  </article>;
}
