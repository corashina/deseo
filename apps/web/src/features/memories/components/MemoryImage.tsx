import { useSession } from '../../../app/SessionProvider';
import { useEffect, useState } from 'react';
import { toAppError } from '@deseo/domain/result';
import { captureQueryScope } from '../../../lib/query-client';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { loadMemoryPhoto } from '../media';
import type { MemoryPhoto } from '@deseo/domain/memories';
export function MemoryImage({ photo, variant = 'thumb', alt }: { photo: MemoryPhoto; variant?: 'full' | 'thumb'; alt: string }) {
  const photoId = photo.id;
  const { pair } = useSession();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const scope = captureQueryScope();
    const controller = new AbortController();
    let objectUrl = '';
    const clear = () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = ''; setUrl(''); };
    scope.signal.addEventListener('abort', clear, { once: true });
    setUrl(''); setError('');
    void loadMemoryPhoto(photoId, variant, controller.signal).then(blob => {
      if (controller.signal.aborted || scope.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(failure => {
      if (controller.signal.aborted || scope.signal.aborted) return;
      const code = toAppError(failure).code;
      setError(code === 'FORBIDDEN' || code === 'UNAUTHENTICATED' ? 'This photo is unavailable. Open the memory again.' : 'We could not load this photo.');
    });
    return () => { scope.signal.removeEventListener('abort', clear); clear(); };
  }, [photoId, variant, generation, pair]);
  return url ? <img src={url} alt={alt} width={variant === 'full' ? photo.width : photo.thumbWidth} height={variant === 'full' ? photo.height : photo.thumbHeight} /> : <div className="memory-image-state">{error ? <><Status error>{error}</Status><Button variant="secondary" onClick={() => setGeneration(value => value + 1)}>Retry photo</Button></> : <Status>Loading photo…</Status>}</div>;
}
