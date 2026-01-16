import { 
  users, 
  garages, 
  chatMessages, 
  reports,
  type User, 
  type InsertUser,
  type Garage,
  type ChatMessage,
  type InsertChatMessage,
  type Report,
  type InsertReport,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, lt, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getGarages(): Promise<Garage[]>;
  getGarage(id: string): Promise<Garage | undefined>;
  
  getChatMessages(garageId: string, limit?: number, before?: string): Promise<(ChatMessage & { userName: string })[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage & { userName: string }>;
  deleteChatMessage(id: string, deletedBy: string): Promise<void>;
  
  createReport(report: InsertReport): Promise<Report>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getGarages(): Promise<Garage[]> {
    return db.select().from(garages).orderBy(garages.name);
  }

  async getGarage(id: string): Promise<Garage | undefined> {
    const [garage] = await db.select().from(garages).where(eq(garages.id, id));
    return garage || undefined;
  }

  async getChatMessages(garageId: string, limit = 50, before?: string): Promise<(ChatMessage & { userName: string })[]> {
    let query = db
      .select({
        id: chatMessages.id,
        garageId: chatMessages.garageId,
        userId: chatMessages.userId,
        content: chatMessages.content,
        isDeleted: chatMessages.isDeleted,
        deletedBy: chatMessages.deletedBy,
        createdAt: chatMessages.createdAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(
        before 
          ? and(eq(chatMessages.garageId, garageId), lt(chatMessages.id, before))
          : eq(chatMessages.garageId, garageId)
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    const messages = await query;
    return messages as (ChatMessage & { userName: string })[];
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage & { userName: string }> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    
    const user = message.userId ? await this.getUser(message.userId) : null;
    
    return {
      ...newMessage,
      userName: user?.username || 'Unknown',
    };
  }

  async deleteChatMessage(id: string, deletedBy: string): Promise<void> {
    await db
      .update(chatMessages)
      .set({ isDeleted: true, deletedBy })
      .where(eq(chatMessages.id, id));
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db
      .insert(reports)
      .values(report)
      .returning();
    return newReport;
  }
}

export const storage = new DatabaseStorage();
