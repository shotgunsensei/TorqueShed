export type UserRole = 'user' | 'vendor' | 'moderator' | 'admin';

export type ProductStatus = 'pending' | 'approved' | 'rejected';

export type ReportReason = 'spam' | 'harassment' | 'scam' | 'illegal' | 'impersonation' | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export type ContentType = 'chat_message' | 'forum_thread' | 'forum_reply' | 'user';

export interface Profile {
  id: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  specialties: string[] | null;
  role: UserRole;
  reputation_score: number;
  is_banned: boolean;
  banned_until: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Garage {
  id: string;
  name: string;
  description: string | null;
  brand_color: string | null;
  member_count: number;
  created_at: string;
}

export interface GarageMember {
  user_id: string;
  garage_id: string;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  garage_id: string;
  user_id: string | null;
  content: string;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface ForumThread {
  id: string;
  garage_id: string;
  user_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_deleted: boolean;
  deleted_by: string | null;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
}

export interface ForumReply {
  id: string;
  thread_id: string;
  user_id: string | null;
  content: string;
  is_deleted: boolean;
  deleted_by: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleNote {
  id: string;
  vehicle_id: string;
  user_id: string;
  title: string;
  content: string;
  is_private: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: string | null;
  vendor_name: string | null;
  affiliate_url: string;
  category: string | null;
  image_url: string | null;
  status: ProductStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string | null;
  reported_user_id: string;
  content_type: ContentType;
  content_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  action_taken: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface UserBlock {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'reputation_score' | 'is_banned' | 'banned_until' | 'ban_reason'> & {
          reputation_score?: number;
          is_banned?: boolean;
          banned_until?: string | null;
          ban_reason?: string | null;
        };
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      garages: {
        Row: Garage;
        Insert: Omit<Garage, 'created_at' | 'member_count'> & { member_count?: number };
        Update: Partial<Omit<Garage, 'id' | 'created_at'>>;
      };
      garage_members: {
        Row: GarageMember;
        Insert: Omit<GarageMember, 'joined_at'>;
        Update: never;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Pick<ChatMessage, 'garage_id' | 'user_id' | 'content'>;
        Update: Pick<ChatMessage, 'is_deleted' | 'deleted_by' | 'deleted_at'>;
      };
      forum_threads: {
        Row: ForumThread;
        Insert: Pick<ForumThread, 'garage_id' | 'user_id' | 'title' | 'content'> & {
          is_pinned?: boolean;
        };
        Update: Partial<Pick<ForumThread, 'title' | 'content' | 'is_pinned' | 'is_locked' | 'is_deleted' | 'deleted_by'>>;
      };
      forum_replies: {
        Row: ForumReply;
        Insert: Pick<ForumReply, 'thread_id' | 'user_id' | 'content'>;
        Update: Partial<Pick<ForumReply, 'content' | 'is_deleted' | 'deleted_by'>>;
      };
      vehicles: {
        Row: Vehicle;
        Insert: Pick<Vehicle, 'user_id'> & Partial<Pick<Vehicle, 'vin' | 'year' | 'make' | 'model' | 'nickname' | 'image_url'>>;
        Update: Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at'>>;
      };
      vehicle_notes: {
        Row: VehicleNote;
        Insert: Pick<VehicleNote, 'vehicle_id' | 'user_id' | 'title' | 'content'> & {
          is_private?: boolean;
        };
        Update: Partial<Pick<VehicleNote, 'title' | 'content' | 'is_private' | 'share_token'>>;
      };
      products: {
        Row: Product;
        Insert: Pick<Product, 'title' | 'affiliate_url' | 'submitted_by'> & Partial<Pick<Product, 'description' | 'price' | 'vendor_name' | 'category' | 'image_url'>>;
        Update: Partial<Pick<Product, 'title' | 'description' | 'price' | 'vendor_name' | 'affiliate_url' | 'category' | 'image_url' | 'status' | 'reviewed_by' | 'reviewed_at' | 'rejection_reason'>>;
      };
      reports: {
        Row: Report;
        Insert: Pick<Report, 'reporter_id' | 'reported_user_id' | 'content_type' | 'reason'> & Partial<Pick<Report, 'content_id' | 'details'>>;
        Update: Partial<Pick<Report, 'status' | 'reviewed_by' | 'action_taken' | 'reviewed_at'>>;
      };
      user_blocks: {
        Row: UserBlock;
        Insert: Omit<UserBlock, 'created_at'>;
        Update: never;
      };
    };
    Functions: {
      is_user_banned: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      is_garage_member: {
        Args: { user_uuid: string; garage_id_param: string };
        Returns: boolean;
      };
      is_blocked: {
        Args: { blocker_uuid: string; blocked_uuid: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_mod_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      ban_user: {
        Args: { target_user_id: string; ban_duration?: string | null; reason?: string | null };
        Returns: boolean;
      };
      unban_user: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      approve_product: {
        Args: { product_id: string };
        Returns: boolean;
      };
      reject_product: {
        Args: { product_id: string; reason?: string };
        Returns: boolean;
      };
      promote_to_vendor: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
    };
  };
}
