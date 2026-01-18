-- Migration: 00004_create_chat_messages_table
-- Description: Create chat messages table with RLS
-- Created: 2026-01-16

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  garage_id VARCHAR(50) REFERENCES public.garages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_messages_garage_time ON public.chat_messages(garage_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_not_deleted ON public.chat_messages(garage_id, created_at DESC) 
  WHERE is_deleted = FALSE;

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages

-- Helper function to check if user is banned
CREATE OR REPLACE FUNCTION public.is_user_banned(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid
    AND is_banned = TRUE
    AND (banned_until IS NULL OR banned_until > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is garage member
CREATE OR REPLACE FUNCTION public.is_garage_member(user_uuid UUID, garage_id_param VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.garage_members
    WHERE user_id = user_uuid AND garage_id = garage_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Messages readable by members of that garage (or all authenticated for MVP)
CREATE POLICY "Chat messages viewable by authenticated users"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    is_deleted = FALSE
    -- For stricter access (members only), uncomment:
    -- AND public.is_garage_member(auth.uid(), garage_id)
  );

-- Messages writable by authenticated non-banned users
CREATE POLICY "Authenticated non-banned users can send messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_user_banned(auth.uid())
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_deleted = TRUE
    AND deleted_by = auth.uid()
  );

-- Moderators and admins can delete any message
CREATE POLICY "Mods and admins can delete messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (is_deleted = TRUE);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
