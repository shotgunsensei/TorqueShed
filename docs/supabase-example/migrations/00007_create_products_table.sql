-- Migration: 00007_create_products_table
-- Description: Create products/vendor submissions table with RLS
-- Created: 2026-01-16

-- Products table (vendor submissions + approved products)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL CHECK (char_length(title) BETWEEN 3 AND 255),
  description TEXT,
  price VARCHAR(20),
  vendor_name VARCHAR(100),
  affiliate_url TEXT NOT NULL,
  category VARCHAR(50),
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_approved ON public.products(category, created_at DESC) WHERE status = 'approved';
CREATE INDEX idx_products_submitted_by ON public.products(submitted_by);
CREATE INDEX idx_products_pending ON public.products(created_at DESC) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products

-- All authenticated users can view approved products (marketplace)
CREATE POLICY "Approved products viewable by all authenticated users"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- Vendors can view their own submissions (any status)
CREATE POLICY "Vendors can view own submissions"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Admins can view all products
CREATE POLICY "Admins can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Vendors and admins can create submissions
CREATE POLICY "Vendors and admins can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('vendor', 'admin')
    )
  );

-- Only admins can update products (approve/reject)
CREATE POLICY "Admins can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete products
CREATE POLICY "Admins can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
