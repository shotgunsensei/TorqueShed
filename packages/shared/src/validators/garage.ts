import { z } from 'zod';

export const createGarageSchema = z.object({
  id: z
    .string()
    .min(2, 'Garage ID must be at least 2 characters')
    .max(50, 'Garage ID must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Garage ID can only contain lowercase letters, numbers, and hyphens'),
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional().nullable(),
  brand_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Brand color must be a valid hex color')
    .optional()
    .nullable(),
});

export const updateGarageSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional().nullable(),
  brand_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Brand color must be a valid hex color')
    .optional()
    .nullable(),
});

export const joinGarageSchema = z.object({
  garage_id: z.string().min(1, 'Garage ID is required'),
});

export type CreateGarageInput = z.infer<typeof createGarageSchema>;
export type UpdateGarageInput = z.infer<typeof updateGarageSchema>;
export type JoinGarageInput = z.infer<typeof joinGarageSchema>;
