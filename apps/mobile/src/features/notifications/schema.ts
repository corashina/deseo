import { z } from 'zod';
const uuid = z.string().uuid();
export const permissionSchema = z.enum(['allowed', 'denied', 'not_requested']);
export const deviceSchema = z.object({ installationId: uuid, token: z.string().regex(/^(Expo|Exponent)PushToken\[[^\]\s]+\]$/).nullable(),
  platform: z.enum(['ios', 'android']), permission: permissionSchema }).refine(input => input.permission === 'allowed' ? input.token !== null : input.token === null);
