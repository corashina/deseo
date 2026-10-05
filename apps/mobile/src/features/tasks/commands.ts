import { taskPayload } from '@deseo/domain/tasks';
import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { errorResult, resultSchema, type Result } from '@deseo/domain/result';
import { listNameSchema, listRowSchema, taskInputSchema, taskRowSchema } from '@deseo/domain/tasks';
import type { Task, TaskInput, TaskList } from '@deseo/domain/tasks';
const uuid = z.string().uuid();
const version = z.number().int().positive();
const idRow = z.object({ id: uuid });

async function command<T extends z.ZodTypeAny>(name: string, parameters: Record<string, unknown>, schema: T): Promise<Result<z.infer<T>>> {
  try {
    uuid.parse(parameters.p_command_id);
    const scope = captureQueryScope();
    const client = await getSupabase(); scope.assertCurrent();
    const response = await client.rpc(name, parameters).abortSignal(scope.signal); scope.assertCurrent();
    if (response.error) return errorResult(response.error);
    const result = resultSchema(schema).parse(response.data);
    if (result.ok) await queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'tasks' || query.queryKey[0] === 'today' });
    scope.assertCurrent();
    return result;
  } catch (error) { return errorResult(error); }
}
async function save(input: TaskInput, commandId: string, expectedVersion?: number): Promise<Result<Task>> {
  try {
    const parsed = taskInputSchema.parse(input);
    if (expectedVersion !== undefined) version.parse(expectedVersion);
    return command(expectedVersion === undefined ? 'create_task' : 'update_task', { p_input: taskPayload(parsed), p_command_id: commandId,
      ...(expectedVersion === undefined ? {} : { p_task_id: parsed.id, p_expected_version: expectedVersion }) }, taskRowSchema);
  } catch (error) { return errorResult(error); }
}
export function createTask(input: TaskInput, commandId: string): Promise<Result<Task>> { return save(input, commandId); }
export function updateTask(id: string, input: TaskInput, expectedVersion: number, commandId: string): Promise<Result<Task>> {
  if (id !== input.id) return Promise.resolve({ ok: false, error: { code: 'VALIDATION', message: 'The task ID changed.' } });
  try { version.parse(expectedVersion); } catch (error) { return Promise.resolve(errorResult(error)); }
  return save(input, commandId, expectedVersion);
}
export async function setTaskCompleted(id: string, completed: boolean, expectedVersion: number, commandId: string): Promise<Result<Task>> {
  try { uuid.parse(id); z.boolean().parse(completed); version.parse(expectedVersion);
    return command('set_task_completed', { p_task_id: id, p_completed: completed, p_expected_version: expectedVersion, p_command_id: commandId }, taskRowSchema);
  } catch (error) { return errorResult(error); }
}
export async function deleteTask(id: string, expectedVersion: number, commandId: string): Promise<Result<{ id: string }>> {
  try { uuid.parse(id); version.parse(expectedVersion); return command('delete_task', { p_task_id: id, p_expected_version: expectedVersion, p_command_id: commandId }, idRow); }
  catch (error) { return errorResult(error); }
}
export async function createList(pairId: string, name: string, commandId: string): Promise<Result<TaskList>> {
  try { uuid.parse(pairId); return command('create_list', { p_pair_id: pairId, p_name: listNameSchema.parse(name), p_command_id: commandId }, listRowSchema); }
  catch (error) { return errorResult(error); }
}
export async function renameList(id: string, name: string, expectedVersion: number, commandId: string): Promise<Result<TaskList>> {
  try { uuid.parse(id); version.parse(expectedVersion); return command('rename_list', { p_list_id: id, p_name: listNameSchema.parse(name), p_expected_version: expectedVersion, p_command_id: commandId }, listRowSchema); }
  catch (error) { return errorResult(error); }
}
export async function moveListTasksToGeneral(id: string, commandId: string): Promise<Result<{ id: string; generalListId: string; moved: number }>> {
  try { uuid.parse(id); return command('move_list_tasks_to_general', { p_list_id: id, p_command_id: commandId }, z.object({ id: uuid, generalListId: uuid, moved: z.number().int().nonnegative() })); }
  catch (error) { return errorResult(error); }
}
export async function deleteEmptyList(id: string, commandId: string): Promise<Result<{ id: string }>> {
  try { uuid.parse(id); return command('delete_empty_list', { p_list_id: id, p_command_id: commandId }, idRow); }
  catch (error) { return errorResult(error); }
}
