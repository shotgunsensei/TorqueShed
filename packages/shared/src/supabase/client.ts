import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database, Profile, Garage, ChatMessage, ForumThread, ForumReply, Vehicle, VehicleNote, Product, Report, UserBlock } from '../types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  options?: {
    auth?: {
      persistSession?: boolean;
      autoRefreshToken?: boolean;
      detectSessionInUrl?: boolean;
    };
  };
}

let supabaseInstance: TypedSupabaseClient | null = null;

export function createSupabaseClient(config: SupabaseConfig): TypedSupabaseClient {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: config.options?.auth?.persistSession ?? true,
      autoRefreshToken: config.options?.auth?.autoRefreshToken ?? true,
      detectSessionInUrl: config.options?.auth?.detectSessionInUrl ?? true,
    },
  });
}

export function initSupabase(config: SupabaseConfig): TypedSupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(config);
  }
  return supabaseInstance;
}

export function getSupabase(): TypedSupabaseClient {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabaseInstance;
}

export function resetSupabase(): void {
  supabaseInstance = null;
}

export type Tables = {
  profiles: Profile;
  garages: Garage;
  chat_messages: ChatMessage;
  forum_threads: ForumThread;
  forum_replies: ForumReply;
  vehicles: Vehicle;
  vehicle_notes: VehicleNote;
  products: Product;
  reports: Report;
  user_blocks: UserBlock;
};

export type TableName = keyof Tables;

export { RealtimeChannel };
