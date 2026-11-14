import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { memoryPhotoQuery } from '../media';
export function MemoryImage({ path, alt }: { path: string; alt: string }) {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery(memoryPhotoQuery(account!.id, pairId, path));
  const [url, setUrl] = useState('');
  // Release the object URL when the photo changes or leaves the page.
  useEffect(() => {
    if (!query.data) return;
    const value = URL.createObjectURL(query.data);
    setUrl(value);
    return () => { URL.revokeObjectURL(value); setUrl(''); };
  }, [query.data]);
  if (url) return <img src={url} alt={alt} />;
  const code = query.isError ? toAppError(query.error).code : null;
  const error = !code ? '' : code === 'FORBIDDEN' || code === 'UNAUTHENTICATED' ? 'This photo is unavailable. Open the memory again.' : 'We could not load this photo.';
  return <div className="memory-image-state">{error ? <><Status error>{error}</Status><Button variant="secondary" onClick={() => void query.refetch()}>Retry photo</Button></> : <Status>Loading photo…</Status>}</div>;
}
