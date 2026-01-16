import { z } from 'zod';

const reportReasons = ['spam', 'harassment', 'scam', 'illegal', 'impersonation', 'other'] as const;
const contentTypes = ['chat_message', 'forum_thread', 'forum_reply', 'user'] as const;

export const createReportSchema = z.object({
  reported_user_id: z.string().uuid('Invalid user ID'),
  content_type: z.enum(contentTypes),
  content_id: z.string().uuid('Invalid content ID').optional().nullable(),
  reason: z.enum(reportReasons),
  details: z.string().max(1000, 'Details must be at most 1000 characters').optional().nullable(),
});

export const reviewReportSchema = z.object({
  report_id: z.string().uuid('Invalid report ID'),
  status: z.enum(['reviewed', 'actioned', 'dismissed']),
  action_taken: z.string().max(500, 'Action description must be at most 500 characters').optional().nullable(),
});

export const blockUserSchema = z.object({
  blocked_id: z.string().uuid('Invalid user ID'),
});

export const getReportsSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'actioned', 'dismissed']).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReviewReportInput = z.infer<typeof reviewReportSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
export type GetReportsInput = z.infer<typeof getReportsSchema>;
