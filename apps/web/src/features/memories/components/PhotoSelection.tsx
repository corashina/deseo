import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { PreparedBrowserPhoto } from '../prepare';
function Preview({ photo }: { photo: PreparedBrowserPhoto }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const value = URL.createObjectURL(photo.thumb); setUrl(value); return () => URL.revokeObjectURL(value); }, [photo]);
  return url ? <img src={url} alt="Selected photo" /> : null;
}
export function PhotoSelection({ photos, disabled, preparing, onSelect, onRemove, progress }: { photos: PreparedBrowserPhoto[]; disabled: boolean; preparing: boolean; onSelect(files: File[]): void; onRemove(id: string): void; progress: string }) {
  return <div className="photo-selection"><label className="field"><span>Photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || preparing || photos.length === 5} onChange={event => { onSelect(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
    <p>Choose one to five photos. Deseo saves JPEG copies, up to 5 MiB each.</p>
    <div className="photo-selection-grid">{photos.map((photo, index) => <div key={photo.id}><Preview photo={photo} /><Button variant="secondary" disabled={disabled || preparing} onClick={() => onRemove(photo.id)}>Remove photo {index + 1}</Button></div>)}</div>
    <p role="status">{preparing ? 'Preparing photos…' : progress}</p>
  </div>;
}
