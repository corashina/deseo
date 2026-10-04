// Importance: 98. Invitation entry must reject foreign origins and preserve the code.
jest.mock('./private-storage', () => ({ getPrivateStorage: jest.fn() }));
import { parseInviteLink, setPendingInvite, getPendingInvite } from './links';
import { getPrivateStorage } from './private-storage';

const token = '0123456789AB';
afterEach(() => { delete process.env.EXPO_PUBLIC_SITE_URL; });
test('accepts the development route and normalizes a readable code', () => {
  expect(parseInviteLink(`deseo-dev://invite?token=0123-4567-89ab`)).toBe(token);
});
test('accepts only the configured HTTPS site origin and invitation route', () => {
  process.env.EXPO_PUBLIC_SITE_URL = 'https://example.com';
  expect(parseInviteLink(`https://example.com/invite?token=${token}`)).toBe(token);
  expect(parseInviteLink(`https://evil.example.com/invite?token=${token}`)).toBeNull();
  expect(parseInviteLink(`http://example.com/invite?token=${token}`)).toBeNull();
  expect(parseInviteLink(`https://example.com/invite?token=${token}&token=${token}`)).toBeNull();
  expect(parseInviteLink(`https://example.com/invite?token=${token}#secret`)).toBeNull();
});
test('stores intent independently of account drafts', async () => {
  const intent = new Map<string, string>();
  (getPrivateStorage as jest.Mock).mockResolvedValue({
    setIntent: async (key: string, value: string) => { intent.set(key, value); },
    getIntent: async (key: string) => intent.get(key) ?? null,
  });
  await setPendingInvite('0123-4567-89ab');
  expect(await getPendingInvite()).toBe(token);
});
