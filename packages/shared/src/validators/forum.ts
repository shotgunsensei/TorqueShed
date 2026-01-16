import { z } from 'zod';

export const createForumThreadSchema = z.object({
  garage_id: z.string().min(1, 'Garage ID is required'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title must be at most 255 characters'),
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must be at most 10000 characters'),
});

export const updateForumThreadSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title must be at most 255 characters')
    .optional(),
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must be at most 10000 characters')
    .optional(),
});

export const moderateThreadSchema = z.object({
  thread_id: z.string().uuid('Invalid thread ID'),
  action: z.enum(['pin', 'unpin', 'lock', 'unlock', 'delete']),
});

export const createForumReplySchema = z.object({
  thread_id: z.string().uuid('Invalid thread ID'),
  content: z
    .string()
    .min(1, 'Reply cannot be empty')
    .max(5000, 'Reply must be at most 5000 characters'),
});

export const updateForumReplySchema = z.object({
  content: z
    .string()
    .min(1, 'Reply cannot be empty')
    .max(5000, 'Reply must be at most 5000 characters'),
});

export const getForumThreadsSchema = z.object({
  garage_id: z.string().min(1, 'Garage ID is required'),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const getForumRepliesSchema = z.object({
  thread_id: z.string().uuid('Invalid thread ID'),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

export type CreateForumThreadInput = z.infer<typeof createForumThreadSchema>;
export type UpdateForumThreadInput = z.infer<typeof updateForumThreadSchema>;
export type ModerateThreadInput = z.infer<typeof moderateThreadSchema>;
export type CreateForumReplyInput = z.infer<typeof createForumReplySchema>;
export type UpdateForumReplyInput = z.infer<typeof updateForumReplySchema>;
export type GetForumThreadsInput = z.infer<typeof getForumThreadsSchema>;
export type GetForumRepliesInput = z.infer<typeof getForumRepliesSchema>;
