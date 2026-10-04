import { MemoriesScreen, MemoryAccessBoundary } from '../../features/memories';
export default function MemoriesTab() {
  return <MemoryAccessBoundary><MemoriesScreen /></MemoryAccessBoundary>;
}
