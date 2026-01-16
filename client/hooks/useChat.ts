import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket, type ChatMessage } from "./useWebSocket";

interface UseChatOptions {
  garageId: string;
  userId: string;
  userName: string;
}

export function useChat({ garageId, userId, userName }: UseChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  const { data: initialMessages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/garages", garageId, "messages"],
    staleTime: 0,
  });

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages.reverse());
    }
  }, [initialMessages]);

  const handleNewMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    setTypingUsers((prev) => {
      const next = new Map(prev);
      next.delete(message.userId || "");
      return next;
    });
  }, []);

  const handleUserTyping = useCallback((typingUserId: string, typingUserName: string) => {
    if (typingUserId === userId) return;
    
    setTypingUsers((prev) => {
      const next = new Map(prev);
      next.set(typingUserId, typingUserName);
      return next;
    });

    setTimeout(() => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(typingUserId);
        return next;
      });
    }, 3000);
  }, [userId]);

  const { status, sendMessage: wsSendMessage, sendTyping } = useWebSocket({
    garageId,
    userId,
    userName,
    onMessage: handleNewMessage,
    onTyping: handleUserTyping,
  });

  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    wsSendMessage(content.trim());
  }, [wsSendMessage]);

  const loadMoreMessages = useCallback(async () => {
    if (messages.length === 0) return;
    
    const oldestMessage = messages[0];
    const response = await fetch(
      `/api/garages/${garageId}/messages?before=${oldestMessage.id}&limit=50`
    );
    if (response.ok) {
      const olderMessages: ChatMessage[] = await response.json();
      setMessages((prev) => [...olderMessages.reverse(), ...prev]);
    }
  }, [garageId, messages]);

  return {
    messages,
    isLoading,
    connectionStatus: status,
    typingUsers: Array.from(typingUsers.values()),
    sendMessage,
    sendTyping,
    loadMoreMessages,
  };
}
