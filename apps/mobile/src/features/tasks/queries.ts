import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { taskRowSchema, listRowSchema } from '@deseo/domain/tasks';
import type { Task, TaskList } from '@deseo/domain/tasks';
export const taskKeys = {
  all: (accountId: string, pairId: string) => ['tasks', accountId, pairId] as const,
  lists: (accountId: string, pairId: string) => [...taskKeys.all(accountId, pairId), 'lists'] as const,
  list: (accountId: string, pairId: string, listId: string) => [...taskKeys.all(accountId, pairId), 'list', listId] as const,
  task: (accountId: string, pairId: string, id: string) => [...taskKeys.all(accountId, pairId), 'task', id] as const,
};
export async function listTaskLists(pairId: string): Promise<TaskList[]> {
  z.string().uuid().parse(pairId); const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
  const rows: TaskList[] = [];
  for (let offset = 0; ; offset += 50) {
    const response = await client.from('task_lists').select('*').eq('pair_id', pairId).order('is_general', { ascending: false }).order('id').range(offset, offset + 49).abortSignal(scope.signal);
    scope.assertCurrent(); if (response.error) throw response.error;
    const page = z.array(listRowSchema).parse(response.data); rows.push(...page); if (page.length < 50) return rows;
  }
}
export async function listTasks(pairId: string, listId: string): Promise<Task[]> {
  z.string().uuid().parse(pairId); z.string().uuid().parse(listId); const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
  const rows: Task[] = [];
  for (let offset = 0; ; offset += 50) {
    const response = await client.from('tasks').select('*').eq('pair_id', pairId).eq('list_id', listId).order('created_at').order('id').range(offset, offset + 49).abortSignal(scope.signal);
    scope.assertCurrent(); if (response.error) throw response.error;
    const page = z.array(taskRowSchema).parse(response.data); rows.push(...page); if (page.length < 50) return rows;
  }
}
export async function getTask(pairId: string, id: string): Promise<Task | null> {
  z.string().uuid().parse(pairId); z.string().uuid().parse(id); const scope = captureQueryScope(); const client = await getSupabase(); scope.assertCurrent();
  const response = await client.from('tasks').select('*').eq('pair_id', pairId).eq('id', id).abortSignal(scope.signal).maybeSingle();
  scope.assertCurrent(); if (response.error) throw response.error; return response.data === null ? null : taskRowSchema.parse(response.data);
}
// Dates are pair-local dates. Today supplies the date in the pair timezone.
