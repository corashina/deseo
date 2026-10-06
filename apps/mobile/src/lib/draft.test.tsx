// Importance: 98. Drafts must keep retry identity, conflict review, and local edits through restarts and failures.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { z } from 'zod';
import { randomUUID } from 'expo-crypto';
import { useDraft, type DraftOptions } from './draft';
import { getPrivateStorage } from './private-storage';
import type { Result } from '@deseo/domain/result';

jest.mock('./private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('./query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

const accountId = '10000000-0000-4000-8000-000000000001';
const pairId = '30000000-0000-4000-8000-000000000001';
const itemId = '40000000-0000-4000-8000-000000000001';
type Values = { title: string };
type Input = { id: string; pairId: string; title: string };
type Saved = { id: string; version: number };
const input = z.object({ id: z.string().uuid(), pairId: z.string().uuid(), title: z.string().min(1) });
let stored: Map<string, string>;
let setDraft: jest.Mock;
let command: jest.Mock<Promise<Result<Saved>>, [Input, { commandId: string; expectedVersion?: number }]>;
let reload: jest.Mock;
let onSaved: jest.Mock;
let ids: number;

beforeEach(() => {
  jest.clearAllMocks(); stored = new Map(); ids = 0;
  jest.mocked(randomUUID).mockImplementation(() => `50000000-0000-4000-8000-00000000000${++ids}` as never);
  setDraft = jest.fn(async (_account: string, _pair: string, key: string, value: string) => { stored.set(key, value); });
  jest.mocked(getPrivateStorage).mockResolvedValue({
    getDraft: async (_account: string, _pair: string, key: string) => stored.get(key) ?? null,
    setDraft,
    removeDraft: async (_account: string, _pair: string, key: string) => { stored.delete(key); },
  } as never);
  command = jest.fn(); reload = jest.fn(); onSaved = jest.fn();
});

function options(overrides: Partial<DraftOptions<Values, Input, Saved>> = {}): DraftOptions<Values, Input, Saved> {
  return { accountId, pairId, key: 'items:edit', online: true,
    values: z.object({ title: z.string() }), rules: z.object({ title: z.string().trim().min(1, 'Enter a title.') }), input,
    initial: { id: itemId, expectedVersion: 3, values: { title: 'Bread' } },
    toInput: (values, identity) => ({ ...values, id: identity.id, pairId }),
    command: (value, identity) => command(value, identity), reload: () => reload(), onSaved: (saved) => onSaved(saved), ...overrides };
}
async function mount(overrides?: Partial<DraftOptions<Values, Input, Saved>>) {
  const view = await renderHook(() => useDraft(options(overrides)));
  await waitFor(() => expect(view.result.current.ready || view.result.current.storageError !== null).toBe(true));
  return view;
}
async function stage(view: Awaited<ReturnType<typeof mount>>, title: string) {
  await act(async () => { view.result.current.form.setValue('title', title); });
}

it('reviews a conflict, keeps local edits through a restart, and saves against the reloaded version', async () => {
  command.mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  let view = await mount();
  await stage(view, 'Local bread');
  await act(() => view.result.current.save());
  expect(view.result.current.error?.code).toBe('CONFLICT');
  await view.unmount();
  view = await mount();
  expect(view.result.current.error?.code).toBe('CONFLICT');
  expect(view.result.current.form.getValues('title')).toBe('Local bread');
  reload.mockResolvedValue({ values: { title: 'Partner bread' }, expectedVersion: 4 });
  await act(() => view.result.current.reloadSaved());
  expect(view.result.current.form.getValues('title')).toBe('Partner bread');
  await view.unmount();
  view = await mount();
  expect(view.result.current.canRestore).toBe(true);
  await act(() => view.result.current.restore());
  expect(view.result.current.form.getValues('title')).toBe('Local bread');
  command.mockResolvedValue({ ok: true, data: { id: itemId, version: 5 } });
  await act(() => view.result.current.save());
  expect(command).toHaveBeenCalledTimes(2);
  expect(command.mock.calls[1]![1]).toMatchObject({ expectedVersion: 4 });
  expect(command.mock.calls[1]![1].commandId).not.toBe(command.mock.calls[0]![1].commandId);
});

it('retries an unconfirmed save after a restart with the same input, command ID, and version', async () => {
  command.mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  let view = await mount();
  await stage(view, 'Local bread');
  await act(() => view.result.current.save());
  const first = command.mock.calls[0]!;
  await view.unmount();
  view = await mount();
  expect(view.result.current.frozen).toBe(true);
  expect(view.result.current.error?.code).toBe('RETRYABLE');
  await act(() => view.result.current.retry());
  expect(command.mock.calls[1]).toEqual(first);
  expect(first[1]).toMatchObject({ expectedVersion: 3 });
});

it('removes the draft and reports the saved item after a confirmed save', async () => {
  command.mockResolvedValue({ ok: true, data: { id: itemId, version: 4 } });
  const view = await mount();
  await stage(view, 'Local bread');
  await act(() => view.result.current.save());
  expect(onSaved).toHaveBeenCalledWith({ id: itemId, version: 4 });
  expect(stored.has('items:edit')).toBe(false);
});

it('keeps an offline edit on the device and sends nothing', async () => {
  const view = await mount({ online: false });
  await stage(view, 'Offline bread');
  await waitFor(() => expect(view.result.current.savedOnDevice).toBe(true));
  expect(JSON.parse(stored.get('items:edit')!).values.title).toBe('Offline bread');
  await act(() => view.result.current.save());
  expect(command).not.toHaveBeenCalled();
});

it('blocks the command and reports the failure when the draft cannot be written', async () => {
  setDraft.mockRejectedValue(new Error('storage unavailable'));
  const view = await mount();
  await act(() => view.result.current.save());
  expect(command).not.toHaveBeenCalled();
  expect(view.result.current.storageError).toBe('We could not save your draft on this device. Keep this screen open.');
});

it('shows a field conflict on the field and keeps the draft editable', async () => {
  command.mockResolvedValue({ ok: false, error: { code: 'CONFLICT', field: 'title' } });
  const view = await mount();
  await act(() => view.result.current.save());
  expect(view.result.current.error).toBeNull();
  expect(view.result.current.frozen).toBe(false);
  expect(view.result.current.form.getFieldState('title').error?.message).toBe('This value is already in use.');
});

it('refuses a stored submission from another pair without deleting it', async () => {
  const foreign = JSON.stringify({ id: itemId, commandId: '50000000-0000-4000-8000-000000000009', expectedVersion: 3,
    values: { title: 'Bread' }, submission: { id: itemId, pairId: '30000000-0000-4000-8000-000000000002', title: 'Bread' } });
  stored.set('items:edit', foreign);
  const view = await mount();
  expect(view.result.current.ready).toBe(false);
  expect(view.result.current.storageError).toBe('We could not open your draft. Open this screen again.');
  expect(stored.get('items:edit')).toBe(foreign);
});
