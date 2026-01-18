-- Migration: 00010_create_admin_functions
-- Description: Admin helper functions and stored procedures
-- Created: 2026-01-16

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is moderator or admin
CREATE OR REPLACE FUNCTION public.is_mod_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ban a user (admin/mod only)
CREATE OR REPLACE FUNCTION public.ban_user(
  target_user_id UUID,
  ban_duration INTERVAL DEFAULT NULL,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_mod_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only moderators and admins can ban users';
  END IF;
  
  UPDATE public.profiles
  SET 
    is_banned = TRUE,
    banned_until = CASE 
      WHEN ban_duration IS NULL THEN NULL -- Permanent ban
      ELSE NOW() + ban_duration
    END,
    ban_reason = reason,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unban a user (admin/mod only)
CREATE OR REPLACE FUNCTION public.unban_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_mod_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only moderators and admins can unban users';
  END IF;
  
  UPDATE public.profiles
  SET 
    is_banned = FALSE,
    banned_until = NULL,
    ban_reason = NULL,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve a product (admin only)
CREATE OR REPLACE FUNCTION public.approve_product(product_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve products';
  END IF;
  
  UPDATE public.products
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    rejection_reason = NULL
  WHERE id = product_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a product (admin only)
CREATE OR REPLACE FUNCTION public.reject_product(
  product_id UUID,
  reason TEXT DEFAULT 'Does not meet guidelines'
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject products';
  END IF;
  
  UPDATE public.products
  SET 
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    rejection_reason = reason
  WHERE id = product_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote user to vendor (admin only)
CREATE OR REPLACE FUNCTION public.promote_to_vendor(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can promote users';
  END IF;
  
  UPDATE public.profiles
  SET role = 'vendor', updated_at = NOW()
  WHERE id = target_user_id AND role = 'user';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending reports count (for mod dashboard)
CREATE OR REPLACE FUNCTION public.get_pending_reports_count()
RETURNS INTEGER AS $$
BEGIN
  IF NOT public.is_mod_or_admin() THEN
    RETURN 0;
  END IF;
  
  RETURN (SELECT COUNT(*) FROM public.reports WHERE status = 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending products count (for admin dashboard)
CREATE OR REPLACE FUNCTION public.get_pending_products_count()
RETURNS INTEGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN 0;
  END IF;
  
  RETURN (SELECT COUNT(*) FROM public.products WHERE status = 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
