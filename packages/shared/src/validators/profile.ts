import { z } from 'zod';
import { handleSchema, urlSchema } from './common';

export const createProfileSchema = z.object({
  id: z.string().uuid(),
  handle: handleSchema,
  avatar_url: urlSchema.optional().nullable(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional().nullable(),
  location: z.string().max(100, 'Location must be at most 100 characters').optional().nullable(),
  specialties: z.array(z.string().max(50)).max(10, 'Maximum 10 specialties').optional().nullable(),
});

export const updateProfileSchema = z.object({
  handle: handleSchema.optional(),
  avatar_url: urlSchema.optional().nullable(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional().nullable(),
  location: z.string().max(100, 'Location must be at most 100 characters').optional().nullable(),
  specialties: z.array(z.string().max(50)).max(10, 'Maximum 10 specialties').optional().nullable(),
});

export const banUserSchema = z.object({
  target_user_id: z.string().uuid(),
  ban_duration: z.string().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
