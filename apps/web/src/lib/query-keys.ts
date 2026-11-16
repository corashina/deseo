import { queryClient } from './query-client';
// Every query key starts with one root. Commands and signals invalidate by root or by a longer prefix.
export type QueryRoot = 'calendar' | 'tasks' | 'messages' | 'memories' | 'memory-photo' | 'today';
export type QueryPrefix = readonly [QueryRoot, ...unknown[]];
export type QueryKeys = Record<string, (...args: never[]) => QueryPrefix>;
// TanStack Query matches each key by prefix.
export async function invalidate(...prefixes: QueryPrefix[]): Promise<void> {
  await Promise.all(prefixes.map(queryKey => queryClient.invalidateQueries({ queryKey })));
}
