-- ============================================
-- GearHead Combined Migration
-- Run this file to create all tables at once
-- ============================================

-- ============================================
-- 00001: Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 00002: Profiles Table
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle VARCHAR(50) UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  location VARCHAR(100),
  specialties TEXT[],
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'vendor', 'moderator', 'admin')),
  reputation_score INTEGER DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  banned_until TIMESTAMPTZ,
  ban_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_handle ON public.profiles(handle);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = TRUE;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, handle)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || LEFT(NEW.id::TEXT, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 00003: Garages Tables
-- ============================================
CREATE TABLE public.garages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  brand_color VARCHAR(7),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.garage_members (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  garage_id VARCHAR(50) REFERENCES public.garages(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, garage_id)
);

CREATE INDEX idx_garage_members_garage ON public.garage_members(garage_id);
CREATE INDEX idx_garage_members_user ON public.garage_members(user_id);

ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Garages are viewable by authenticated users"
  ON public.garages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage garages"
  ON public.garages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Garage memberships are viewable by authenticated users"
  ON public.garage_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own garage membership"
  ON public.garage_members FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

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
  FOR EACH ROW EXECUTE FUNCTION public.update_garage_member_count();

-- ============================================
-- 00004: Chat Messages Table
-- ============================================
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

CREATE INDEX idx_chat_messages_garage_time ON public.chat_messages(garage_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_not_deleted ON public.chat_messages(garage_id, created_at DESC) WHERE is_deleted = FALSE;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_banned(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid AND is_banned = TRUE
    AND (banned_until IS NULL OR banned_until > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_garage_member(user_uuid UUID, garage_id_param VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.garage_members
    WHERE user_id = user_uuid AND garage_id = garage_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Chat messages viewable by authenticated users"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (is_deleted = FALSE);

CREATE POLICY "Authenticated non-banned users can send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_deleted = TRUE AND deleted_by = auth.uid());

CREATE POLICY "Mods and admins can delete messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')))
  WITH CHECK (is_deleted = TRUE);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ============================================
-- 00005: Forum Tables
-- ============================================
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

CREATE TABLE public.forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_threads_garage ON public.forum_threads(garage_id, last_activity_at DESC);
CREATE INDEX idx_forum_threads_not_deleted ON public.forum_threads(garage_id, last_activity_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_forum_replies_thread ON public.forum_replies(thread_id, created_at ASC);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum threads viewable by authenticated users"
  ON public.forum_threads FOR SELECT TO authenticated USING (is_deleted = FALSE);

CREATE POLICY "Authenticated non-banned users can create threads"
  ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

CREATE POLICY "Users can update own threads"
  ON public.forum_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_deleted = FALSE) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Mods and admins can manage threads"
  ON public.forum_threads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')));

CREATE POLICY "Forum replies viewable by authenticated users"
  ON public.forum_replies FOR SELECT TO authenticated USING (is_deleted = FALSE);

CREATE POLICY "Authenticated non-banned users can create replies"
  ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND NOT public.is_user_banned(auth.uid())
    AND EXISTS (SELECT 1 FROM public.forum_threads WHERE id = thread_id AND is_locked = FALSE AND is_deleted = FALSE)
  );

CREATE POLICY "Users can update own replies"
  ON public.forum_replies FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_deleted = FALSE) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Mods and admins can manage replies"
  ON public.forum_replies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')));

CREATE OR REPLACE FUNCTION public.update_thread_on_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads SET reply_count = reply_count + 1, last_activity_at = NOW() WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads SET reply_count = reply_count - 1 WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_forum_reply_change
  AFTER INSERT OR DELETE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_on_reply();

-- ============================================
-- 00006: Vehicles & Notes Tables
-- ============================================
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

CREATE INDEX idx_vehicles_user ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_vin ON public.vehicles(vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_vehicle_notes_vehicle ON public.vehicle_notes(vehicle_id, created_at DESC);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vehicles" ON public.vehicles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own vehicles" ON public.vehicles FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can view own notes" ON public.vehicle_notes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create notes for own vehicles" ON public.vehicle_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own notes" ON public.vehicle_notes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own notes" ON public.vehicle_notes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER on_vehicle_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_vehicle_note_updated BEFORE UPDATE ON public.vehicle_notes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 00007: Products Table
-- ============================================
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

CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_approved ON public.products(category, created_at DESC) WHERE status = 'approved';
CREATE INDEX idx_products_submitted_by ON public.products(submitted_by);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved products viewable by all authenticated users"
  ON public.products FOR SELECT TO authenticated USING (status = 'approved');

CREATE POLICY "Vendors can view own submissions"
  ON public.products FOR SELECT TO authenticated USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Vendors and admins can create products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('vendor', 'admin')));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 00008: Moderation Tables
-- ============================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('chat_message', 'forum_thread', 'forum_reply', 'user')),
  content_id UUID,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'scam', 'illegal', 'impersonation', 'other')),
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id),
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE public.user_blocks (
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "Mods and admins can view all reports" ON public.reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')));
CREATE POLICY "Authenticated users can create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Mods and admins can update reports" ON public.reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')));

CREATE POLICY "Users can view own blocks" ON public.user_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "Users can create blocks" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocker_id != blocked_id);
CREATE POLICY "Users can delete own blocks" ON public.user_blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked(blocker_uuid UUID, blocked_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = blocker_uuid AND blocked_id = blocked_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 00009: Seed Data
-- ============================================
INSERT INTO public.garages (id, name, description, brand_color, member_count) VALUES
  ('ford', 'Ford Garage', 'Built Ford Tough community for F-Series, Mustang, Bronco, and all Ford enthusiasts', '#003478', 0),
  ('dodge', 'Dodge Garage', 'Mopar or no car! Challenger, Charger, Ram, and all Dodge/Chrysler vehicles', '#C8102E', 0),
  ('chevy', 'Chevy Garage', 'Like a rock community for Silverado, Camaro, Corvette, and Chevrolet fans', '#F2A900', 0),
  ('jeep', 'Jeep Garage', 'Trail rated adventurers - Wrangler, Gladiator, Cherokee, and all Jeep models', '#006341', 0),
  ('general', 'General Garage', 'All makes and models welcome - the universal automotive community', '#757575', 0),
  ('swap-shop', 'Swap Shop', 'Buy, sell, and trade automotive parts and accessories', '#FF6B35', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (title, description, price, vendor_name, affiliate_url, category, status) VALUES
  ('K&N Cold Air Intake Kit', 'High-flow performance air intake for improved horsepower and throttle response.', '$349.99', 'K&N Engineering', 'https://www.knfilters.com', 'Performance', 'approved'),
  ('Bilstein 5100 Shock Kit', 'Premium monotube shocks for lifted trucks. Adjustable ride height.', '$599.99', 'Bilstein', 'https://www.bilstein.com', 'Suspension', 'approved'),
  ('Flowmaster Super 44 Muffler', 'Aggressive deep tone exhaust with improved flow.', '$179.99', 'Flowmaster', 'https://www.flowmastermufflers.com', 'Exhaust', 'approved'),
  ('Rigid Industries LED Light Bar', '20-inch spot/flood combo LED bar, 20,000 lumens.', '$449.99', 'Rigid Industries', 'https://www.rigidindustries.com', 'Lighting', 'approved'),
  ('WeatherTech Floor Liners', 'Custom-fit floor protection for all weather conditions.', '$189.99', 'WeatherTech', 'https://www.weathertech.com', 'Interior', 'approved'),
  ('Borla Cat-Back Exhaust System', 'T-304 stainless steel performance exhaust.', '$899.99', 'Borla', 'https://www.borla.com', 'Exhaust', 'approved')
ON CONFLICT DO NOTHING;

-- ============================================
-- 00010: Admin Functions
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_mod_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.ban_user(target_user_id UUID, ban_duration INTERVAL DEFAULT NULL, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_mod_or_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET is_banned = TRUE, banned_until = CASE WHEN ban_duration IS NULL THEN NULL ELSE NOW() + ban_duration END, ban_reason = reason, updated_at = NOW() WHERE id = target_user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unban_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_mod_or_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET is_banned = FALSE, banned_until = NULL, ban_reason = NULL, updated_at = NOW() WHERE id = target_user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.approve_product(product_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.products SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW(), rejection_reason = NULL WHERE id = product_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_product(product_id UUID, reason TEXT DEFAULT 'Does not meet guidelines')
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.products SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = NOW(), rejection_reason = reason WHERE id = product_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.promote_to_vendor(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET role = 'vendor', updated_at = NOW() WHERE id = target_user_id AND role = 'user';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
