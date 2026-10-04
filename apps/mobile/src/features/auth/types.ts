import type { z } from 'zod';
import type { AppError } from '../../lib/result';
import type { accountSchema, profileSchema, sensitiveActionSchema, sessionContextSchema } from './schema';

export type Account = z.infer<typeof accountSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type SensitiveAction = z.infer<typeof sensitiveActionSchema>;
export type SessionContext = z.infer<typeof sessionContextSchema>;
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; error?: AppError }
  | { status: 'error'; error: AppError }
  | ({ status: 'authenticated' } & SessionContext);
