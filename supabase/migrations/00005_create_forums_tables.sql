-- Migration: 00005_create_forums_tables
-- Description: Create forum threads and replies tables with RLS
-- Created: 2026-01-16

-- Forum threads table
CREATE TABLE public.forum_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  garage_id VARCHAR(50) REFERENCES public.garages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL CHECK (char_length(title) BETWEEN 5 AND 255),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 10000),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES public.profiles(id),
  reply_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum replies table
CREATE TABLE public.forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forum_threads_garage ON public.forum_threads(garage_id, last_activity_at DESC);
CREATE INDEX idx_forum_threads_user ON public.forum_threads(user_id);
CREATE INDEX idx_forum_threads_not_deleted ON public.forum_threads(garage_id, last_activity_at DESC) 
  WHERE is_deleted = FALSE;

CREATE INDEX idx_forum_replies_thread ON public.forum_replies(thread_id, created_at ASC);
CREATE INDEX idx_forum_replies_user ON public.forum_replies(user_id);

-- Enable RLS
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_threads

-- Threads readable by all authenticated users
CREATE POLICY "Forum threads viewable by authenticated users"
  ON public.forum_threads
  FOR SELECT
  TO authenticated
  USING (is_deleted = FALSE);

-- Authenticated non-banned users can create threads
CREATE POLICY "Authenticated non-banned users can create threads"
  ON public.forum_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_user_banned(auth.uid())
  );

-- Users can update their own threads (edit content)
CREATE POLICY "Users can update own threads"
  ON public.forum_threads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_deleted = FALSE)
  WITH CHECK (user_id = auth.uid());

-- Admins and moderators can delete/pin/lock any thread
CREATE POLICY "Mods and admins can manage threads"
  ON public.forum_threads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- RLS Policies for forum_replies

-- Replies readable by all authenticated users
CREATE POLICY "Forum replies viewable by authenticated users"
  ON public.forum_replies
  FOR SELECT
  TO authenticated
  USING (is_deleted = FALSE);

-- Authenticated non-banned users can create replies (if thread not locked)
CREATE POLICY "Authenticated non-banned users can create replies"
  ON public.forum_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_user_banned(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.forum_threads
      WHERE id = thread_id AND is_locked = FALSE AND is_deleted = FALSE
    )
  );

-- Users can update their own replies
CREATE POLICY "Users can update own replies"
  ON public.forum_replies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_deleted = FALSE)
  WITH CHECK (user_id = auth.uid());

-- Admins and moderators can delete any reply
CREATE POLICY "Mods and admins can manage replies"
  ON public.forum_replies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- Trigger to update reply count and last activity
CREATE OR REPLACE FUNCTION public.update_thread_on_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads 
    SET reply_count = reply_count + 1,
        last_activity_at = NOW()
    WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads 
    SET reply_count = reply_count - 1
    WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_forum_reply_change
  AFTER INSERT OR DELETE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_thread_on_reply();
