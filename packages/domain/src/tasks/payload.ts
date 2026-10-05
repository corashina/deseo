import type { TaskInput } from './types';

export function taskPayload(input: TaskInput) {
  return { id: input.id, pair_id: input.pairId, list_id: input.listId, title: input.title, assignee_id: input.assigneeId, due_date: input.dueDate };
}
