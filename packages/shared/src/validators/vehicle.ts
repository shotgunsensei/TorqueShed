import { z } from 'zod';
import { vinSchema, yearSchema, urlSchema } from './common';

export const createVehicleSchema = z
  .object({
    vin: vinSchema,
    year: yearSchema,
    make: z.string().max(50, 'Make must be at most 50 characters').optional().nullable(),
    model: z.string().max(100, 'Model must be at most 100 characters').optional().nullable(),
    nickname: z.string().max(100, 'Nickname must be at most 100 characters').optional().nullable(),
    image_url: urlSchema.optional().nullable(),
  })
  .refine(
    (data) => data.vin || (data.year && data.make && data.model),
    {
      message: 'Either VIN or Year/Make/Model is required',
    }
  );

export const updateVehicleSchema = z.object({
  vin: vinSchema,
  year: yearSchema,
  make: z.string().max(50, 'Make must be at most 50 characters').optional().nullable(),
  model: z.string().max(100, 'Model must be at most 100 characters').optional().nullable(),
  nickname: z.string().max(100, 'Nickname must be at most 100 characters').optional().nullable(),
  image_url: urlSchema.optional().nullable(),
});

export const createVehicleNoteSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(5000, 'Content must be at most 5000 characters'),
  is_private: z.boolean().optional().default(true),
});

export const updateVehicleNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters')
    .optional(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(5000, 'Content must be at most 5000 characters')
    .optional(),
  is_private: z.boolean().optional(),
});

export const shareVehicleNoteSchema = z.object({
  note_id: z.string().uuid('Invalid note ID'),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type CreateVehicleNoteInput = z.infer<typeof createVehicleNoteSchema>;
export type UpdateVehicleNoteInput = z.infer<typeof updateVehicleNoteSchema>;
export type ShareVehicleNoteInput = z.infer<typeof shareVehicleNoteSchema>;
