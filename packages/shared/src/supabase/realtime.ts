import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabase, TableName, Tables } from './client';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeSubscription<T> {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export type ChangePayload<T> = RealtimePostgresChangesPayload<T>;

export function subscribeToTable<T extends TableName>(
  table: T,
  event: RealtimeEvent,
  callback: (payload: ChangePayload<Tables[T]>) => void,
  filter?: { column: string; value: string }
): RealtimeSubscription<Tables[T]> {
  const supabase = getSupabase();
  
  const channelName = filter 
    ? `${table}-${filter.column}-${filter.value}` 
    : `${table}-all`;

  const channelConfig: Record<string, unknown> = {
    event,
    schema: 'public',
    table,
  };

  if (filter) {
    channelConfig.filter = `${filter.column}=eq.${filter.value}`;
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes' as never,
      channelConfig as never,
      (payload: ChangePayload<Tables[T]>) => {
        callback(payload);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export function subscribeToChatMessages(
  garageId: string,
  callback: (payload: ChangePayload<Tables['chat_messages']>) => void
): RealtimeSubscription<Tables['chat_messages']> {
  return subscribeToTable('chat_messages', 'INSERT', callback, {
    column: 'garage_id',
    value: garageId,
  });
}

export function subscribeToForumThreads(
  garageId: string,
  callback: (payload: ChangePayload<Tables['forum_threads']>) => void
): RealtimeSubscription<Tables['forum_threads']> {
  return subscribeToTable('forum_threads', '*', callback, {
    column: 'garage_id',
    value: garageId,
  });
}

export function subscribeToForumReplies(
  threadId: string,
  callback: (payload: ChangePayload<Tables['forum_replies']>) => void
): RealtimeSubscription<Tables['forum_replies']> {
  return subscribeToTable('forum_replies', 'INSERT', callback, {
    column: 'thread_id',
    value: threadId,
  });
}

export function createPresenceChannel(
  channelName: string
): RealtimeChannel {
  const supabase = getSupabase();
  return supabase.channel(channelName, {
    config: {
      presence: {
        key: 'user',
      },
    },
  });
}

export function cleanupAllChannels(): void {
  const supabase = getSupabase();
  supabase.removeAllChannels();
}
