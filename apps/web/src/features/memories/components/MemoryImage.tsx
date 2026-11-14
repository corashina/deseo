import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { memoryPhotoQuery } from '../media';
import type { MemoryPhoto } from '@deseo/domain/memories';
export function MemoryImage({ photo, variant = 'thumb', alt }: { photo: MemoryPhoto; variant?: 'full' | 'thumb'; alt: string }) {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const full = variant === 'full';
  const query = useQuery(memoryPhotoQuery(account!.id, pairId, full ? photo.fullPath : photo.thumbPath));
  const [url, setUrl] = useState('');
  // Release the object URL when the photo changes or leaves the page.
  useEffect(() => {
    if (!query.data) return;
    const value = URL.createObjectURL(query.data);
    setUrl(value);
    return () => { URL.revokeObjectURL(value); setUrl(''); };
  }, [query.data]);
  if (url) return <img src={url} alt={alt} width={full ? photo.width : photo.thumbWidth} height={full ? photo.height : photo.thumbHeight} />;
  const code = query.isError ? toAppError(query.error).code : null;
  const error = !code ? '' : code === 'FORBIDDEN' || code === 'UNAUTHENTICATED' ? 'This photo is unavailable. Open the memory again.' : 'We could not load this photo.';
  return <div className="memory-image-state">{error ? <><Status error>{error}</Status><Button variant="secondary" onClick={() => void query.refetch()}>Retry photo</Button></> : <Status>Loading photo…</Status>}</div>;
}
