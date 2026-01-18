import { useEffect, useRef, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatMessage {
  id: string;
  garageId: string;
  userId: string | null;
  userName: string;
  content: string;
  createdAt: string;
  isDeleted?: boolean;
}

interface WSMessage {
  type: string;
  payload: unknown;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error" | "unauthenticated";

interface UseWebSocketOptions {
  garageId: string;
  onMessage?: (message: ChatMessage) => void;
  onUserJoined?: (userId: string, userName: string) => void;
  onUserLeft?: (userId: string, userName: string) => void;
  onTyping?: (userId: string, userName: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { garageId, onMessage, onUserJoined, onUserLeft, onTyping } = options;
  const { accessToken, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) {
      setStatus("unauthenticated");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const baseUrl = getApiUrl();
      const wsUrl = baseUrl.replace(/^https?:\/\//, "wss://") + `ws/chat?token=${encodeURIComponent(accessToken)}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case "authenticated":
              ws.send(JSON.stringify({
                type: "join_garage",
                payload: { garageId },
              }));
              break;
            case "new_message":
              onMessage?.(message.payload as ChatMessage);
              break;
            case "user_joined":
              const joinPayload = message.payload as { userId: string; userName: string };
              onUserJoined?.(joinPayload.userId, joinPayload.userName);
              break;
            case "user_left":
              const leftPayload = message.payload as { userId: string; userName: string };
              onUserLeft?.(leftPayload.userId, leftPayload.userName);
              break;
            case "user_typing":
              const typingPayload = message.payload as { userId: string; userName: string };
              onTyping?.(typingPayload.userId, typingPayload.userName);
              break;
            case "error":
              console.error("WebSocket error from server:", message.payload);
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        if (event.code !== 4001 && isAuthenticated) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setStatus("error");
    }
  }, [garageId, accessToken, isAuthenticated, onMessage, onUserJoined, onUserLeft, onTyping]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "send_message",
        payload: { garageId, content },
      }));
    }
  }, [garageId]);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    sendMessage,
    sendTyping,
    reconnect: connect,
  };
}
