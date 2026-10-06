import { useCallback, useEffect, useRef } from 'react';
import { captureQueryScope } from './query-client';

// Keep callbacks inside their mounted page and current request scope.
export function useCommandScope(onAbort: () => void) {
  const mounted = useRef(false);
  const unlock = useRef(onAbort);
  const cleanup = useRef<() => void>(undefined);
  const revision = useRef(0);
  useEffect(() => { unlock.current = onAbort; });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; cleanup.current?.(); };
  }, []);
  return useCallback(() => {
    cleanup.current?.();
    const request = ++revision.current;
    const scope = captureQueryScope();
    const isCurrent = () => mounted.current && request === revision.current && !scope.signal.aborted;
    const abort = () => { if (mounted.current && request === revision.current) unlock.current(); };
    scope.signal.addEventListener('abort', abort, { once: true });
    cleanup.current = () => scope.signal.removeEventListener('abort', abort);
    return { ...scope, isCurrent };
  }, []);
}
