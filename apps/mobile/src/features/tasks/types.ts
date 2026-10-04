export type TaskInput = { id: string; pairId: string; listId: string; title: string; assigneeId: string | null; dueDate: string | null };
export type Task = TaskInput & { authorId: string; completedAt: string | null; completedBy: string | null; version: number };
export type TaskList = { id: string; pairId: string; name: string; isGeneral: boolean; authorId: string | null; version: number };
