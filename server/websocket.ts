import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { URL } from "url";
import { storage } from "./storage";
import { verifyJWT } from "./middleware/auth";
import type { ChatMessage } from "@shared/schema";

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  garageId: string | null;
}

interface WSMessage {
  type: string;
  payload: unknown;
}

interface JoinGaragePayload {
  garageId: string;
}

interface SendMessagePayload {
  garageId: string;
  content: string;
}

const clients: Map<WebSocket, AuthenticatedClient> = new Map();

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws/chat" });

  wss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      console.log("WebSocket connection rejected: Missing token");
      ws.close(4001, "Authentication required");
      return;
    }

    const payload = verifyJWT(token);
    if (!payload) {
      console.log("WebSocket connection rejected: Invalid token");
      ws.close(4001, "Invalid or expired token");
      return;
    }

    const user = await storage.getUser(payload.sub);
    if (!user) {
      console.log("WebSocket connection rejected: User not found");
      ws.close(4001, "User not found");
      return;
    }

    const client: AuthenticatedClient = {
      ws,
      userId: user.id,
      userName: user.username,
      garageId: null,
    };
    clients.set(ws, client);

    console.log(`WebSocket client authenticated: ${user.username} (${user.id})`);

    ws.send(JSON.stringify({ 
      type: "authenticated", 
      payload: { userId: user.id, userName: user.username } 
    }));

    ws.on("message", async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await handleMessage(ws, message, wss);
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
      }
    });

    ws.on("close", () => {
      const existingClient = clients.get(ws);
      if (existingClient && existingClient.garageId) {
        broadcastToGarage(wss, existingClient.garageId, {
          type: "user_left",
          payload: { userId: existingClient.userId, userName: existingClient.userName },
        }, ws);
      }
      clients.delete(ws);
      console.log(`WebSocket client disconnected: ${client.userName}`);
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

  return wss;
}

async function handleMessage(ws: WebSocket, message: WSMessage, wss: WebSocketServer) {
  const client = clients.get(ws);
  if (!client) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Not authenticated" } }));
    return;
  }

  switch (message.type) {
    case "join_garage": {
      const payload = message.payload as JoinGaragePayload;
      
      if (client.garageId && client.garageId !== payload.garageId) {
        broadcastToGarage(wss, client.garageId, {
          type: "user_left",
          payload: { userId: client.userId, userName: client.userName },
        }, ws);
      }

      client.garageId = payload.garageId;
      
      broadcastToGarage(wss, payload.garageId, {
        type: "user_joined",
        payload: { userId: client.userId, userName: client.userName },
      }, ws);
      
      ws.send(JSON.stringify({ type: "joined", payload: { garageId: payload.garageId } }));
      break;
    }

    case "leave_garage": {
      if (client.garageId) {
        broadcastToGarage(wss, client.garageId, {
          type: "user_left",
          payload: { userId: client.userId, userName: client.userName },
        }, ws);
        client.garageId = null;
      }
      break;
    }

    case "send_message": {
      const payload = message.payload as SendMessagePayload;
      
      if (!client.garageId) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not in a garage" } }));
        return;
      }

      if (client.garageId !== payload.garageId) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not in this garage" } }));
        return;
      }

      const newMessage = await storage.createChatMessage({
        garageId: client.garageId,
        userId: client.userId,
        content: payload.content,
      });

      broadcastToGarage(wss, client.garageId, {
        type: "new_message",
        payload: newMessage,
      });
      break;
    }

    case "typing": {
      if (client.garageId) {
        broadcastToGarage(wss, client.garageId, {
          type: "user_typing",
          payload: { userId: client.userId, userName: client.userName },
        }, ws);
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: "error", payload: { message: "Unknown message type" } }));
  }
}

function broadcastToGarage(wss: WebSocketServer, garageId: string, message: WSMessage, exclude?: WebSocket) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client, clientWs) => {
    if (client.garageId === garageId && clientWs !== exclude && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(messageStr);
    }
  });
}

export function getGarageUserCount(garageId: string): number {
  let count = 0;
  clients.forEach((client) => {
    if (client.garageId === garageId) count++;
  });
  return count;
}
