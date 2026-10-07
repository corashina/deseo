import type { AgendaItem } from '../calendar';
import type { Task } from '../tasks';
import type { Message } from '../messages';
export type TodayView = { agenda: AgendaItem[]; importantDates: AgendaItem[]; dueTasks: Task[]; notes: Message[] };
