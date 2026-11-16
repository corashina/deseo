import { useLocation } from 'react-router-dom';

// A link to a record passes the page it came from in router state.
// The record then returns there, with the same month, view, and filter.
type From = { from?: string };

export function useFrom(): From {
  const { pathname, search } = useLocation();
  return { from: pathname + search };
}

// Use the page in state only when it is the list the Return link names.
export function useReturnTo(list: string): string {
  const from = (useLocation().state as From | null)?.from;
  return from && (from === list || from.startsWith(list + '?')) ? from : list;
}
