import { z } from 'zod';
import { callRpc } from '../../lib/rpc';
import { queryClient } from '../../lib/query-client';
import { listNameSchema, listRowSchema, taskInputSchema, taskPayload, taskRowSchema } from '@deseo/domain/tasks';
import type { Task, TaskInput, TaskList } from '@deseo/domain/tasks';
import type { RpcName } from '../../lib/supabase';
const uuid = z.string().uuid();
const version = z.number().int().positive();
const idRow = z.object({ id: uuid });
// Form writes pass a command ID. A retry of the same input reuses it, so the server stores the write once.
// Other task RPCs get a new command ID on each attempt.
// Expected versions make a concurrent edit fail with CONFLICT.
// A removal does not wait for the refresh, so its page can leave at once.
async function command<T extends z.ZodTypeAny>(name: RpcName, parameters: Record<string, unknown>, schema: T, removal = false): Promise<z.infer<T>> {
  const data = await callRpc(name, { p_command_id: crypto.randomUUID(), ...parameters }, schema);
  const refresh = Promise.all([queryClient.invalidateQueries({ queryKey: ['tasks'] }), queryClient.invalidateQueries({ queryKey: ['today'] })]);
  if (!removal) await refresh;
  return data;
}
export function createTask(input: TaskInput, commandId: string): Promise<Task> {
  return command('create_task', { p_input: taskPayload(taskInputSchema.parse(input)), p_command_id: commandId }, taskRowSchema);
}
export function updateTask(input: TaskInput, expectedVersion: number, commandId: string): Promise<Task> {
  const parsed = taskInputSchema.parse(input);
  return command('update_task', { p_input: taskPayload(parsed), p_task_id: parsed.id, p_expected_version: version.parse(expectedVersion), p_command_id: commandId }, taskRowSchema);
}
export function setTaskCompleted(id: string, completed: boolean, expectedVersion: number): Promise<Task> {
  return command('set_task_completed', { p_task_id: uuid.parse(id), p_completed: completed, p_expected_version: version.parse(expectedVersion) }, taskRowSchema);
}
export function deleteTask(id: string, expectedVersion: number): Promise<{ id: string }> {
  return command('delete_task', { p_task_id: uuid.parse(id), p_expected_version: version.parse(expectedVersion) }, idRow, true);
}
export function createList(pairId: string, name: string, commandId: string): Promise<TaskList> {
  return command('create_list', { p_pair_id: uuid.parse(pairId), p_name: listNameSchema.parse(name), p_command_id: commandId }, listRowSchema);
}
export function renameList(id: string, name: string, expectedVersion: number, commandId: string): Promise<TaskList> {
  return command('rename_list', { p_list_id: uuid.parse(id), p_name: listNameSchema.parse(name), p_expected_version: version.parse(expectedVersion), p_command_id: commandId }, listRowSchema);
}
export function moveListTasksToGeneral(id: string): Promise<{ id: string; generalListId: string; moved: number }> {
  return command('move_list_tasks_to_general', { p_list_id: uuid.parse(id) }, z.object({ id: uuid, generalListId: uuid, moved: z.number().int().nonnegative() }));
}
export function deleteEmptyList(id: string): Promise<{ id: string }> {
  return command('delete_empty_list', { p_list_id: uuid.parse(id) }, idRow, true);
}
