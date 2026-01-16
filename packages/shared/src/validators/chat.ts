import { z } from 'zod';

export const createChatMessageSchema = z.object({
  garage_id: z.string().min(1, 'Garage ID is required'),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be at most 2000 characters'),
});

export const deleteChatMessageSchema = z.object({
  message_id: z.string().uuid('Invalid message ID'),
});

export const getChatMessagesSchema = z.object({
  garage_id: z.string().min(1, 'Garage ID is required'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
});

export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
export type DeleteChatMessageInput = z.infer<typeof deleteChatMessageSchema>;
export type GetChatMessagesInput = z.infer<typeof getChatMessagesSchema>;
