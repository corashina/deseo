import { z } from 'zod';
import { getPrivateStorage } from './private-storage';

export const inviteTokenSchema = z.string().transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{12}$/));
export function parseInviteLink(value: string): string | null {
  try {
    const url = new URL(value);
    const native = url.protocol === 'deseo-dev:' && url.hostname === 'invite' && (url.pathname === '' || url.pathname === '/');
    const site = process.env.EXPO_PUBLIC_SITE_URL;
    const allowedOrigin = site ? new URL(site).origin : null;
    const universal = url.protocol === 'https:' && url.origin === allowedOrigin && url.pathname === '/invite';
    if ((!native && !universal) || url.username || url.password || url.hash || url.port) return null;
    if ([...url.searchParams.keys()].some((key) => key !== 'token') || url.searchParams.getAll('token').length !== 1) return null;
    const token = inviteTokenSchema.safeParse(url.searchParams.get('token'));
    return token.success ? token.data : null;
  } catch { return null; }
}
export async function setPendingInvite(token: string): Promise<void> {
  const value = inviteTokenSchema.parse(token);
  await (await getPrivateStorage()).setIntent('invite', value);
}
export async function getPendingInvite(): Promise<string | null> {
  const value = await (await getPrivateStorage()).getIntent('invite');
  return value === null ? null : inviteTokenSchema.parse(value);
}
export async function clearPendingInvite(): Promise<void> {
  await (await getPrivateStorage()).removeIntent('invite');
}
