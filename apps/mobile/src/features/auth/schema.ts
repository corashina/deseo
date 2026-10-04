import { z } from 'zod';
import { resultSchema } from '../../lib/result';

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const emailCodeSchema = z.string().regex(/^\d{6}$/);
export const timezoneSchema = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
});
export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  timezone: timezoneSchema,
  locale: z.string().min(2).max(35).refine((value) => {
    try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
  }),
});
export const accountSchema = profileSchema.extend({
  id: z.string().uuid(), status: z.enum(['active', 'disabled']), version: z.number().int().positive(),
});
export const sessionContextSchema = z.object({ userId: z.string().uuid(), account: accountSchema.nullable() });
export const sessionResultSchema = resultSchema(sessionContextSchema);
export const sensitiveActionSchema = z.enum(['end_pair']);
