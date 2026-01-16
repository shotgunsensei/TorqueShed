import type { Profile, Garage, ChatMessage, ForumThread, ForumReply, Vehicle, VehicleNote, Product, Report } from './database';

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface ChatMessageWithProfile extends ChatMessage {
  profile: Pick<Profile, 'id' | 'handle' | 'avatar_url'> | null;
}

export interface ForumThreadWithProfile extends ForumThread {
  profile: Pick<Profile, 'id' | 'handle' | 'avatar_url'> | null;
}

export interface ForumReplyWithProfile extends ForumReply {
  profile: Pick<Profile, 'id' | 'handle' | 'avatar_url'> | null;
}

export interface VehicleWithNotes extends Vehicle {
  notes: VehicleNote[];
  notes_count: number;
}

export interface ProductWithVendor extends Product {
  vendor_profile: Pick<Profile, 'id' | 'handle' | 'avatar_url'> | null;
}

export interface GarageWithMembership extends Garage {
  is_member: boolean;
  active_users: number;
}

export interface ReportWithDetails extends Report {
  reporter: Pick<Profile, 'id' | 'handle'> | null;
  reported_user: Pick<Profile, 'id' | 'handle'> | null;
}

export interface VinDecodeResult {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  transmission?: string;
}

export interface PartSearchResult {
  id: string;
  name: string;
  partNumber: string;
  price: string;
  vendor: string;
  vendorUrl: string;
  inStock: boolean;
  compatibility: string[];
}

export type AuthUser = {
  id: string;
  email: string;
  profile: Profile;
};

export type SessionState = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};
