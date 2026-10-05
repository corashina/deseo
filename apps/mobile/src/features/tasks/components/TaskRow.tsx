import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { captureQueryScope } from '../../../lib/query-client';
import type { CommandError } from '@deseo/domain/result';
import { setTaskCompleted } from '../commands';
import { readTaskAction, removeTaskAction, writeTaskAction, type TaskAction } from '../actions';
import type { Task } from '@deseo/domain/tasks';
export type TaskRowProps = { task: Task; accountId: string; assignee: string; online: boolean; onOpen(): void; onCompleted?(task: Task): void };
export function TaskRow({ task, accountId, assignee, online, onOpen, onCompleted }: TaskRowProps) {
  const [current, setCurrent] = useState(task);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false); const busy = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  const [action, setAction] = useState<Extract<TaskAction, { kind: 'complete' }> | null>(null);
  const [undo, setUndo] = useState(task.completedAt !== null);
  const key = `tasks:complete:${task.id}`;
  useEffect(() => { setCurrent(task); }, [task]);
  useEffect(() => {
    let active = true;
    void readTaskAction(accountId, task.pairId, key).then(saved => {
      if (!active) return;
      if (saved && saved.kind === 'complete' && saved.id === task.id) { setAction(saved); setError({ code: 'RETRYABLE', message: 'Confirm the last change before you change this task.' }); }
      setReady(true);
    }).catch(() => { if (active) setError({ code: 'RETRYABLE', message: 'We could not open the saved change. Open this screen again.' }); });
    return () => { active = false; };
  }, [accountId, task.pairId, key, task.id]);
  const submit = async (next: Extract<TaskAction, { kind: 'complete' }>) => {
    if (!online || busy.current || !ready) return;
    const scope = captureQueryScope(); busy.current = true; setPending(true); setAction(next); setOptimistic(next.completed); setError(null);
    try {
      await writeTaskAction(accountId, task.pairId, key, next); scope.assertCurrent();
      const result = await setTaskCompleted(next.id, next.completed, next.expectedVersion, next.commandId); scope.assertCurrent();
      if (result.ok) {
        setCurrent(previous => previous.version > result.data.version ? previous : result.data); setUndo(next.completed); onCompleted?.(result.data);
        await removeTaskAction(accountId, task.pairId, key); scope.assertCurrent(); setAction(null);
      } else {
        setError(result.error);
        if (result.error.code !== 'RETRYABLE') { await removeTaskAction(accountId, task.pairId, key); scope.assertCurrent(); setAction(null); }
      }
    } catch { try { scope.assertCurrent(); setError({ code: 'RETRYABLE', message: 'We could not confirm the change. Retry when connected.' }); } catch { /* Guard removed the row. */ } }
    finally { busy.current = false; try { scope.assertCurrent(); setOptimistic(null); setPending(false); } catch { /* Guard removed the row. */ } }
  };
  const completed = optimistic ?? current.completedAt !== null;
  const change = (desired: boolean) => { void submit({ kind: 'complete', id: task.id, completed: desired, expectedVersion: current.version, commandId: randomUUID() }); };
  return <View style={ui.card}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={task.title} accessibilityState={{ checked: completed, disabled: !online || pending || !ready || !!action, busy: pending }}
      disabled={!online || pending || !ready || !!action} onPress={() => change(!completed)} style={styles.checkbox}>
      <Text style={[styles.mark, completed && styles.checked]} accessibilityElementsHidden importantForAccessibility="no">{completed ? '✓' : '○'}</Text>
      <Text style={[theme.typography.body, styles.title, completed && styles.done]}>{task.title}</Text>
    </Pressable>
    <Text style={theme.typography.secondary}>{assignee}{task.dueDate ? ` · Due ${task.dueDate}` : ''}</Text>
    <Button label="Task details" variant="text" onPress={onOpen} />
    {undo && <Button label="Undo" variant="secondary" disabled={!online || pending || !!action} onPress={() => change(false)} />}
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? 'This task changed. Open details to review it.' : error.message ?? 'We could not change this task.'}
      actionLabel={action ? 'Retry' : 'Review task'} onAction={action ? () => { void submit(action); } : onOpen} />}
  </View>;
}
const styles = StyleSheet.create({ checkbox: { minHeight: theme.touchTarget, flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  title: { flex: 1 }, mark: { color: theme.colors.control, fontSize: 24 }, checked: { color: theme.colors.success }, done: { textDecorationLine: 'line-through' } });
