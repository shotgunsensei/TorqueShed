-- Migration: 00003_create_garages_table
-- Description: Create garages and membership tables with RLS
-- Created: 2026-01-16

-- Garages table
CREATE TABLE public.garages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  brand_color VARCHAR(7),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garage members (many-to-many)
CREATE TABLE public.garage_members (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  garage_id VARCHAR(50) REFERENCES public.garages(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, garage_id)
);

-- Indexes
CREATE INDEX idx_garage_members_garage ON public.garage_members(garage_id);
CREATE INDEX idx_garage_members_user ON public.garage_members(user_id);

-- Enable RLS
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for garages
-- Anyone authenticated can view garages
CREATE POLICY "Garages are viewable by authenticated users"
  ON public.garages
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify garages
CREATE POLICY "Admins can manage garages"
  ON public.garages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for garage_members
-- Users can view all memberships
CREATE POLICY "Garage memberships are viewable by authenticated users"
  ON public.garage_members
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can join/leave garages (manage own membership)
CREATE POLICY "Users can manage own garage membership"
  ON public.garage_members
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to update member count
CREATE OR REPLACE FUNCTION public.update_garage_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.garages SET member_count = member_count + 1 WHERE id = NEW.garage_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.garages SET member_count = member_count - 1 WHERE id = OLD.garage_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_garage_member_change
  AFTER INSERT OR DELETE ON public.garage_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_garage_member_count();
