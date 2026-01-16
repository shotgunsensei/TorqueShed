import { z } from 'zod';
import { urlSchema } from './common';

const productCategories = [
  'Performance',
  'Suspension',
  'Exhaust',
  'Lighting',
  'Interior',
  'Exterior',
  'Wheels',
  'Tires',
  'Brakes',
  'Electronics',
  'Tools',
  'Accessories',
  'Other',
] as const;

export const createProductSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be at most 255 characters'),
  description: z.string().max(2000, 'Description must be at most 2000 characters').optional().nullable(),
  price: z
    .string()
    .max(20, 'Price must be at most 20 characters')
    .regex(/^\$?\d{1,6}(\.\d{2})?$/, 'Invalid price format')
    .optional()
    .nullable(),
  vendor_name: z.string().max(100, 'Vendor name must be at most 100 characters').optional().nullable(),
  affiliate_url: z.string().url('Invalid URL format'),
  category: z.enum(productCategories).optional().nullable(),
  image_url: urlSchema.optional().nullable(),
});

export const updateProductSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be at most 255 characters')
    .optional(),
  description: z.string().max(2000, 'Description must be at most 2000 characters').optional().nullable(),
  price: z
    .string()
    .max(20, 'Price must be at most 20 characters')
    .regex(/^\$?\d{1,6}(\.\d{2})?$/, 'Invalid price format')
    .optional()
    .nullable(),
  vendor_name: z.string().max(100, 'Vendor name must be at most 100 characters').optional().nullable(),
  affiliate_url: z.string().url('Invalid URL format').optional(),
  category: z.enum(productCategories).optional().nullable(),
  image_url: urlSchema.optional().nullable(),
});

export const approveProductSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
});

export const rejectProductSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  reason: z.string().max(500, 'Reason must be at most 500 characters').optional(),
});

export const getProductsSchema = z.object({
  category: z.enum(productCategories).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export type ProductCategory = (typeof productCategories)[number];
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ApproveProductInput = z.infer<typeof approveProductSchema>;
export type RejectProductInput = z.infer<typeof rejectProductSchema>;
export type GetProductsInput = z.infer<typeof getProductsSchema>;
