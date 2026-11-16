import light from '../../../../../brand/icon-web.webp';
import dark from '../../../../../brand/icon-web-dark.webp';
// The icon tile follows the device appearance, so it never glares on a dark surface.
export function BrandIcon({ className, alt, size, priority = false }: { className?: string; alt: string; size: number; priority?: boolean }) {
  return <picture><source srcSet={dark} media="(prefers-color-scheme: dark)" /><img className={className} src={light} alt={alt} width={size} height={size} fetchPriority={priority ? 'high' : undefined} /></picture>;
}
