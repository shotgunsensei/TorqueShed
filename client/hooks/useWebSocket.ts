import { useEffect, useRef, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/query-client";

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

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  garageId: string;
  userId: string;
  userName: string;
  onMessage?: (message: ChatMessage) => void;
  onUserJoined?: (userId: string, userName: string) => void;
  onUserLeft?: (userId: string, userName: string) => void;
  onTyping?: (userId: string, userName: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { garageId, userId, userName, onMessage, onUserJoined, onUserLeft, onTyping } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const baseUrl = getApiUrl();
      const wsUrl = baseUrl.replace(/^https?:\/\//, "wss://") + "ws/chat";
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        setStatus("connected");
        ws.send(JSON.stringify({
          type: "join_garage",
          payload: { garageId, userId, userName },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
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
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setStatus("error");
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setStatus("error");
    }
  }, [garageId, userId, userName, onMessage, onUserJoined, onUserLeft, onTyping]);

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
        payload: { garageId, userId, content },
      }));
    }
  }, [garageId, userId]);

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
