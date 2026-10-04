import type { z } from 'zod';
import type { pairContextSchema, pairMemberSchema, invitePreviewSchema } from './schema';
export type PairContext = z.infer<typeof pairContextSchema>;
export type PairMember = z.infer<typeof pairMemberSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
