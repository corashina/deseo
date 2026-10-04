import type { AgendaItem } from '../calendar';
import type { PairContext } from '../pair';
export type TodayView = { pair: Extract<PairContext, { status: 'active' }>; agenda: AgendaItem[] };
