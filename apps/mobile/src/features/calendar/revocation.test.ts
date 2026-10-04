import { reconcileEventDrafts } from './revocation';
import { getSupabase } from '../../lib/supabase';
import { getPrivateStorage } from '../../lib/private-storage';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent() {} }) }));

// Importance: 100. A former reader must lose an encrypted edit draft when the author makes its source private.
test('a visibility revocation removes only the affected event draft before access resumes', async () => {
  const id = '40000000-0000-4000-8000-000000000001';
  const drafts = new Map([[`calendar:${id}`, 'partner content'], ['calendar:new', 'my unsaved event']]);
  (getPrivateStorage as jest.Mock).mockResolvedValue({ removeDraft: async (_account: string, _pair: string, key: string) => { drafts.delete(key); } });
  const response = { select: () => response, eq: () => response, abortSignal: async () => ({ data: [{ event_id: id }], error: null }) };
  (getSupabase as jest.Mock).mockResolvedValue({ from: () => response });
  await reconcileEventDrafts('account-a', 'pair-a');
  expect([...drafts.keys()]).toEqual(['calendar:new']);
});
