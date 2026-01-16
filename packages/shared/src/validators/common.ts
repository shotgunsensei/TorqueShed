import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const handleSchema = z
  .string()
  .min(3, 'Handle must be at least 3 characters')
  .max(50, 'Handle must be at most 50 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores');

export const urlSchema = z.string().url('Invalid URL format').or(z.literal(''));

export const vinSchema = z
  .string()
  .length(17, 'VIN must be exactly 17 characters')
  .regex(/^[A-HJ-NPR-Z0-9]+$/, 'VIN contains invalid characters')
  .optional()
  .nullable();

export const yearSchema = z
  .number()
  .int()
  .min(1900, 'Year must be 1900 or later')
  .max(2100, 'Year must be 2100 or earlier')
  .optional()
  .nullable();

export const paginationSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
