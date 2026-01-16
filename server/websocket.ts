import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { storage } from "./storage";
import type { ChatMessage } from "@shared/schema";

interface ChatClient {
  ws: WebSocket;
  garageId: string;
  userId: string;
  userName: string;
}

interface WSMessage {
  type: string;
  payload: unknown;
}

interface SendMessagePayload {
  garageId: string;
  userId: string;
  content: string;
}

interface JoinGaragePayload {
  garageId: string;
  userId: string;
  userName: string;
}

const clients: Map<WebSocket, ChatClient> = new Map();

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws/chat" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("WebSocket client connected");

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
      const client = clients.get(ws);
      if (client) {
        broadcastToGarage(wss, client.garageId, {
          type: "user_left",
          payload: { userId: client.userId, userName: client.userName },
        }, ws);
        clients.delete(ws);
      }
      console.log("WebSocket client disconnected");
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

  return wss;
}

async function handleMessage(ws: WebSocket, message: WSMessage, wss: WebSocketServer) {
  switch (message.type) {
    case "join_garage": {
      const payload = message.payload as JoinGaragePayload;
      clients.set(ws, {
        ws,
        garageId: payload.garageId,
        userId: payload.userId,
        userName: payload.userName,
      });
      
      broadcastToGarage(wss, payload.garageId, {
        type: "user_joined",
        payload: { userId: payload.userId, userName: payload.userName },
      }, ws);
      
      ws.send(JSON.stringify({ type: "joined", payload: { garageId: payload.garageId } }));
      break;
    }

    case "leave_garage": {
      const client = clients.get(ws);
      if (client) {
        broadcastToGarage(wss, client.garageId, {
          type: "user_left",
          payload: { userId: client.userId, userName: client.userName },
        }, ws);
        clients.delete(ws);
      }
      break;
    }

    case "send_message": {
      const payload = message.payload as SendMessagePayload;
      const client = clients.get(ws);
      
      if (!client || client.garageId !== payload.garageId) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Not in this garage" } }));
        return;
      }

      const newMessage = await storage.createChatMessage({
        garageId: payload.garageId,
        userId: payload.userId,
        content: payload.content,
      });

      broadcastToGarage(wss, payload.garageId, {
        type: "new_message",
        payload: newMessage,
      });
      break;
    }

    case "typing": {
      const client = clients.get(ws);
      if (client) {
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
