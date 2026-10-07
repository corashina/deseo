import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Status } from '../../../components/ui/Status';
import { makeStyles } from '../../../theme';
import { AppError } from '@deseo/domain/result';
import { getMemoryMedia, memoryKeys } from '../queries';
import { getMemoryLifecycle, subscribeMemoryLifecycle } from '../lifecycle';

export function MemoryImage({ photoId, variant, width, height }: { photoId: string; variant: 'full' | 'thumb'; width: number; height: number }) {
  const styles = useStyles();
  const access = useSyncExternalStore(subscribeMemoryLifecycle, getMemoryLifecycle);
  const [failedGeneration, setFailedGeneration] = useState<string | null>(null);
  const [retried, setRetried] = useState<string | null>(null);
  const identity = `${access.generation}:${photoId}:${variant}`;
  const query = useQuery({ queryKey: [...memoryKeys.media(access.accountId ?? '', access.pairId ?? '', photoId, variant), access.generation],
    enabled: access.status === 'ready', staleTime: 45_000, gcTime: 0, queryFn: async () => {
      const result = await getMemoryMedia(photoId, variant);
      if (!result.ok) throw new AppError(result.error);
      return result.data;
    } });
  const visible = access.status === 'ready' && !query.isFetching && !query.isError && failedGeneration !== identity ? query.data : undefined;
  return <View style={[styles.frame, { aspectRatio: variant === 'thumb' ? 1.5 : width / height }]}>
    {visible ? <Image key={`${identity}:${query.dataUpdatedAt}`} source={{ uri: visible.url }} style={styles.image}
      contentFit={variant === 'thumb' ? 'cover' : 'contain'} cachePolicy="memory" accessibilityLabel="Memory photo"
      onError={() => {
        if (getMemoryLifecycle().generation !== access.generation) return;
        if (retried !== identity) { setRetried(identity); void query.refetch(); } else setFailedGeneration(identity);
      }} /> : query.isError || failedGeneration === identity ? <Status message="We could not load this photo." /> : <Status tone="loading" message="Loading photo…" />}
  </View>;
}
const useStyles = makeStyles(theme => ({
  frame: { width: '100%', overflow: 'hidden', borderRadius: theme.radius.control, backgroundColor: theme.colors.sidebar,
    alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
}));
