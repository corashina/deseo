import { useEffect, useId, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { PreparedBrowserPhoto } from '../prepare';
function Preview({ photo }: { photo: PreparedBrowserPhoto }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const value = URL.createObjectURL(photo.thumb); setUrl(value); return () => URL.revokeObjectURL(value); }, [photo]);
  return url ? <img src={url} alt="Selected photo" width={photo.thumbWidth} height={photo.thumbHeight} /> : null;
}
export function PhotoSelection({ photos, disabled, preparing, onSelect, onRemove, progress }: { photos: PreparedBrowserPhoto[]; disabled: boolean; preparing: boolean; onSelect(files: File[]): void; onRemove(id: string): void; progress: string }) {
  const selectionStatusId = useId();
  return <div className="photo-selection"><div className="field"><span>Photos</span><label className="button secondary photo-picker"><span>Choose photos</span><input aria-label="Photos" aria-describedby={selectionStatusId} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || preparing || photos.length === 5} onChange={event => { onSelect(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label></div>
    <p id={selectionStatusId} role="status">{photos.length ? photos.length + (photos.length === 1 ? ' photo selected.' : ' photos selected.') : 'No photos selected.'}</p>
    <p className="field-hint">Choose one to five photos.</p>
    <div className="photo-selection-grid">{photos.map((photo, index) => <div key={photo.id}><Preview photo={photo} /><Button variant="secondary" disabled={disabled || preparing} onClick={() => onRemove(photo.id)}>Remove photo {index + 1}</Button></div>)}</div>
    <p role="status">{preparing ? 'Preparing photos…' : progress}</p>
  </div>;
}
