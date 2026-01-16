-- Migration: 00006_create_vehicles_tables
-- Description: Create vehicles and notes tables with RLS (private to owner)
-- Created: 2026-01-16

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vin VARCHAR(17),
  year INTEGER CHECK (year >= 1900 AND year <= 2100),
  make VARCHAR(50),
  model VARCHAR(100),
  nickname VARCHAR(100),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle notes table
CREATE TABLE public.vehicle_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  is_private BOOLEAN DEFAULT TRUE,
  share_token VARCHAR(32) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicles_user ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_vin ON public.vehicles(vin) WHERE vin IS NOT NULL;

CREATE INDEX idx_vehicle_notes_vehicle ON public.vehicle_notes(vehicle_id, created_at DESC);
CREATE INDEX idx_vehicle_notes_user ON public.vehicle_notes(user_id);
CREATE INDEX idx_vehicle_notes_share_token ON public.vehicle_notes(share_token) WHERE share_token IS NOT NULL;

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
-- Users can only see their own vehicles
CREATE POLICY "Users can view own vehicles"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own vehicles
CREATE POLICY "Users can create own vehicles"
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own vehicles
CREATE POLICY "Users can update own vehicles"
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own vehicles
CREATE POLICY "Users can delete own vehicles"
  ON public.vehicles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for vehicle_notes
-- Users can only see their own notes (private notes)
-- Future: Add policy for shared notes via share_token
CREATE POLICY "Users can view own notes"
  ON public.vehicle_notes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create notes for their own vehicles
CREATE POLICY "Users can create notes for own vehicles"
  ON public.vehicle_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE id = vehicle_id AND user_id = auth.uid()
    )
  );

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON public.vehicle_notes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes"
  ON public.vehicle_notes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER on_vehicle_updated
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_vehicle_note_updated
  BEFORE UPDATE ON public.vehicle_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
