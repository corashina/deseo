import { z } from 'zod';

export type Id = string;
export const errorCodeSchema = z.enum([
  'UNAUTHENTICATED', 'FORBIDDEN', 'VALIDATION', 'CONFLICT', 'INVITE_UNAVAILABLE',
  'ALREADY_PAIRED', 'RATE_LIMITED', 'QUOTA_EXCEEDED', 'RETRYABLE',
]);
export const commandErrorSchema = z.object({
  code: errorCodeSchema,
  field: z.string().optional(),
  message: z.string().optional(),
  retryAt: z.string().optional(),
});
export type CommandError = z.infer<typeof commandErrorSchema>;
export type Result<T> = { ok: true; data: T } | { ok: false; error: CommandError };
export type Page<T> = { items: T[]; nextCursor: string | null };
const errorMessages: Record<CommandError['code'], string> = {
  UNAUTHENTICATED: 'Sign in again.',
  FORBIDDEN: 'You cannot access this content.',
  VALIDATION: 'Check the entered values.',
  CONFLICT: 'This item changed. Review the latest version.',
  INVITE_UNAVAILABLE: 'This invitation is unavailable. Request a new code.',
  ALREADY_PAIRED: 'Your account already belongs to a pair.',
  RATE_LIMITED: 'Wait before you try again.',
  QUOTA_EXCEEDED: 'You reached the current limit.',
  RETRYABLE: 'We could not complete this request. Try again.',
};
export function resultSchema<T extends z.ZodTypeAny>(data: T): z.ZodType<Result<z.infer<T>>> {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: commandErrorSchema }),
  ]) as z.ZodType<Result<z.infer<T>>>;
}
export class AppError extends Error {
  readonly code: CommandError['code'];
  readonly field?: string;
  readonly retryAt?: string;
  constructor(error: CommandError) {
    super(error.message ?? errorMessages[error.code]);
    this.name = 'AppError';
    this.code = error.code;
    this.field = error.field;
    this.retryAt = error.retryAt;
  }
}
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const parsed = commandErrorSchema.safeParse(error);
  if (parsed.success) return new AppError(parsed.data);
  if (error instanceof z.ZodError) return new AppError({ code: 'VALIDATION', message: 'Check the entered values.' });
  const source = error as { code?: string; status?: number } | null;
  if (source?.code === 'otp_expired' || source?.code === 'otp_disabled') {
    return new AppError({ code: 'VALIDATION', field: 'code', message: 'The code is invalid or expired. Request a new code.' });
  }
  if (source?.status === 429 || source?.code?.includes('rate_limit')) {
    return new AppError({ code: 'RATE_LIMITED', message: 'Wait before you request another code.' });
  }
  if (source?.status === 401) return new AppError({ code: 'UNAUTHENTICATED', message: 'Sign in again.' });
  if (source?.status === 403) return new AppError({ code: 'FORBIDDEN', message: 'You cannot access this account.' });
  return new AppError({ code: 'RETRYABLE', message: 'We could not complete this request. Try again.' });
}
export function failure(code: CommandError['code'], message?: string): Result<never> {
  return { ok: false, error: { code, ...(message ? { message } : {}) } };
}
export function errorResult(error: unknown): Result<never> {
  const appError = toAppError(error);
  return { ok: false, error: { code: appError.code, message: appError.message, field: appError.field, retryAt: appError.retryAt } };
}
