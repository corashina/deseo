import { useRef } from 'react';
// One command ID per submitted input. A retry of the same input reuses it, so the server receipt stores the write once.
// Changed input gets a new ID. Call reset after a success.
export function useCommandId() {
  const last = useRef<{ key: string; id: string }>(undefined);
  return {
    idFor(input: unknown): string {
      const key = JSON.stringify(input);
      if (last.current?.key !== key) last.current = { key, id: crypto.randomUUID() };
      return last.current.id;
    },
    reset() { last.current = undefined; },
  };
}
