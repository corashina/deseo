import { z } from 'zod';
import { AppError } from '@deseo/domain/result';
import { destinationSchema } from '@deseo/domain/notifications';
import type { AllowedDestination } from '@deseo/domain/notifications';
const payloadSchema = z.object({ notificationId: z.string().uuid() }).strict();
export function notificationIdFromPayload(payload: unknown): string | null {
  const parsed = payloadSchema.safeParse(payload); return parsed.success ? parsed.data.notificationId : null;
}
export function notificationRoute(value: AllowedDestination, pairId: string) {
  const destination = destinationSchema.parse(value);
  if (destination.pairId !== pairId) throw new AppError({ code: 'FORBIDDEN' });
  if (destination.kind === 'event') return { pathname: '/events/[eventId]' as const, params: { eventId: destination.id } };
  if (destination.kind === 'task') return { pathname: '/tasks/[taskId]' as const, params: { taskId: destination.id } };
  return { pathname: '/(tabs)/messages' as const, params: { messageId: destination.id } };
}
