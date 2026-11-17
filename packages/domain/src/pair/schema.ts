import { z } from 'zod';

export const pairMemberSchema = z.object({ userId: z.string().uuid(), displayName: z.string(), slot: z.enum(['a', 'b']) });
export const pairContextSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unpaired') }),
  z.object({ status: z.literal('pending'), pairId: z.string().uuid(), member: pairMemberSchema,
    invite: z.object({ expiresAt: z.string() }).nullable() }),
  z.object({ status: z.literal('active'), pairId: z.string().uuid(), members: z.array(pairMemberSchema).length(2) }),
  z.object({ status: z.literal('ended'), pairId: z.string().uuid(), endedAt: z.string(), ownExportDeadline: z.string() }),
]);
export const invitePreviewSchema = z.object({ pairId: z.string().uuid(), inviterName: z.string(), expiresAt: z.string() });
export const createdInviteSchema = z.object({ token: z.string().nullable(), expiresAt: z.string(), alreadyDelivered: z.boolean() });
