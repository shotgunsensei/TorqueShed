import { 
  users, 
  garages, 
  garageMembers,
  vehicles,
  vehicleNotes,
  reports,
  products,
  threads,
  threadReplies,
  swapShopListings,
  type User, 
  type InsertUser,
  type Garage,
  type Report,
  type InsertReport,
  type Product,
  type InsertProduct,
  type FocusArea,
  type Vehicle,
  type InsertVehicle,
  type VehicleNote,
  type InsertVehicleNote,
  type Thread,
  type InsertThread,
  type ThreadReply,
  type InsertThreadReply,
  type SwapShopListing,
  type InsertSwapShopListing,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, or, isNull, gt } from "drizzle-orm";

export interface ProfileUpdate {
  bio?: string;
  location?: string;
  avatarUrl?: string;
  focusAreas?: FocusArea[];
  vehiclesWorkedOn?: string;
  yearsWrenching?: number | null;
  shopAffiliation?: string | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  focusAreas: FocusArea[];
  vehiclesWorkedOn: string | null;
  yearsWrenching: number | null;
  shopAffiliation: string | null;
  createdAt: Date | null;
}

export interface UserStats {
  threadCount: number;
  replyCount: number;
  listingCount: number;
  vehicleCount: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getPublicProfile(id: string): Promise<PublicProfile | undefined>;
  updateUserProfile(id: string, updates: ProfileUpdate): Promise<User | undefined>;
  getUserStats(userId: string): Promise<UserStats>;
  
  getGarages(): Promise<Garage[]>;
  getGarage(id: string): Promise<Garage | undefined>;
  joinGarage(userId: string, garageId: string): Promise<void>;
  leaveGarage(userId: string, garageId: string): Promise<void>;
  isGarageMember(userId: string, garageId: string): Promise<boolean>;
  
  createReport(report: InsertReport): Promise<Report>;
  
  getApprovedProducts(): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct, createdBy: string): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct> & { submissionStatus?: string; featuredExpiration?: Date | null }): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  incrementProductViews(id: string): Promise<void>;
  incrementProductClicks(id: string): Promise<void>;
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

  async deleteUser(id: string): Promise<void> {
    const userVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.userId, id));
    for (const vehicle of userVehicles) {
      await db.delete(vehicleNotes).where(eq(vehicleNotes.vehicleId, vehicle.id));
    }
    await db.delete(vehicles).where(eq(vehicles.userId, id));
    await db.delete(garageMembers).where(eq(garageMembers.userId, id));
    await db.delete(reports).where(eq(reports.reporterId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getPublicProfile(id: string): Promise<PublicProfile | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        location: users.location,
        focusAreas: users.focusAreas,
        vehiclesWorkedOn: users.vehiclesWorkedOn,
        yearsWrenching: users.yearsWrenching,
        shopAffiliation: users.shopAffiliation,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));
    
    if (!user) return undefined;
    
    return {
      ...user,
      focusAreas: (user.focusAreas as FocusArea[]) || [],
    };
  }

  async updateUserProfile(id: string, updates: ProfileUpdate): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const [threadResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(threads)
      .where(eq(threads.userId, userId));
    const [replyResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(threadReplies)
      .where(eq(threadReplies.userId, userId));
    const [listingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(swapShopListings)
      .where(eq(swapShopListings.userId, userId));
    const [vehicleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(eq(vehicles.userId, userId));
    return {
      threadCount: Number(threadResult?.count || 0),
      replyCount: Number(replyResult?.count || 0),
      listingCount: Number(listingResult?.count || 0),
      vehicleCount: Number(vehicleResult?.count || 0),
    };
  }

  async joinGarage(userId: string, garageId: string): Promise<void> {
    await db
      .insert(garageMembers)
      .values({ userId, garageId })
      .onConflictDoNothing();
  }

  async leaveGarage(userId: string, garageId: string): Promise<void> {
    await db
      .delete(garageMembers)
      .where(and(eq(garageMembers.userId, userId), eq(garageMembers.garageId, garageId)));
  }

  async isGarageMember(userId: string, garageId: string): Promise<boolean> {
    const [row] = await db
      .select({ userId: garageMembers.userId })
      .from(garageMembers)
      .where(and(eq(garageMembers.userId, userId), eq(garageMembers.garageId, garageId)));
    return !!row;
  }

  async getGarages(): Promise<(Garage & { threadCount: number })[]> {
    const allGarages = await db.select().from(garages).orderBy(garages.name);
    const result = await Promise.all(allGarages.map(async (garage) => {
      const [memberResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(garageMembers)
        .where(eq(garageMembers.garageId, garage.id));
      const [threadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(threads)
        .where(eq(threads.garageId, garage.id));
      return {
        ...garage,
        memberCount: Number(memberResult?.count || 0),
        threadCount: Number(threadResult?.count || 0),
      };
    }));
    return result;
  }

  async getGarage(id: string): Promise<(Garage & { threadCount: number }) | undefined> {
    const [garage] = await db.select().from(garages).where(eq(garages.id, id));
    if (!garage) return undefined;
    const [memberResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(garageMembers)
      .where(eq(garageMembers.garageId, id));
    const [threadResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(threads)
      .where(eq(threads.garageId, id));
    return {
      ...garage,
      memberCount: Number(memberResult?.count || 0),
      threadCount: Number(threadResult?.count || 0),
    };
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db
      .insert(reports)
      .values(report)
      .returning();
    return newReport;
  }

  async getApprovedProducts(): Promise<Product[]> {
    const now = new Date();
    return db
      .select()
      .from(products)
      .where(
        and(
          or(
            eq(products.submissionStatus, "approved"),
            and(
              eq(products.submissionStatus, "featured"),
              or(
                isNull(products.featuredExpiration),
                gt(products.featuredExpiration, now)
              )
            )
          )
        )
      )
      .orderBy(desc(products.submissionStatus), desc(products.createdAt));
  }

  async getAllProducts(): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct, createdBy: string): Promise<Product> {
    const [newProduct] = await db
      .insert(products)
      .values({ ...product, createdBy, submissionStatus: "approved" })
      .returning();
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct> & { submissionStatus?: string; featuredExpiration?: Date | null }): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async incrementProductViews(id: string): Promise<void> {
    await db
      .update(products)
      .set({ views: sql`${products.views} + 1` })
      .where(eq(products.id, id));
  }

  async incrementProductClicks(id: string): Promise<void> {
    await db
      .update(products)
      .set({ clicks: sql`${products.clicks} + 1` })
      .where(eq(products.id, id));
  }

  async getVehiclesByUser(userId: string): Promise<(Vehicle & { notesCount: number })[]> {
    const userVehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId))
      .orderBy(desc(vehicles.createdAt));
    
    const result = await Promise.all(userVehicles.map(async (vehicle) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(vehicleNotes)
        .where(eq(vehicleNotes.vehicleId, vehicle.id));
      return { ...vehicle, notesCount: Number(countResult?.count || 0) };
    }));
    
    return result;
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(vehicle: InsertVehicle, userId: string): Promise<Vehicle> {
    const [newVehicle] = await db
      .insert(vehicles)
      .values({ ...vehicle, userId })
      .returning();
    return newVehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [updated] = await db
      .update(vehicles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteVehicle(id: string): Promise<void> {
    await db.delete(vehicleNotes).where(eq(vehicleNotes.vehicleId, id));
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  async getNotesByVehicle(vehicleId: string): Promise<VehicleNote[]> {
    return db
      .select()
      .from(vehicleNotes)
      .where(eq(vehicleNotes.vehicleId, vehicleId))
      .orderBy(desc(vehicleNotes.createdAt));
  }

  async getNote(id: string): Promise<VehicleNote | undefined> {
    const [note] = await db.select().from(vehicleNotes).where(eq(vehicleNotes.id, id));
    return note || undefined;
  }

  async createNote(note: InsertVehicleNote, userId: string): Promise<VehicleNote> {
    const [newNote] = await db
      .insert(vehicleNotes)
      .values({ ...note, userId })
      .returning();
    return newNote;
  }

  async updateNote(id: string, updates: Partial<InsertVehicleNote>): Promise<VehicleNote | undefined> {
    const [updated] = await db
      .update(vehicleNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vehicleNotes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(vehicleNotes).where(eq(vehicleNotes.id, id));
  }

  async getThreadsByGarage(garageId: string): Promise<(Thread & { userName: string })[]> {
    const garageThreads = await db
      .select({
        id: threads.id,
        garageId: threads.garageId,
        userId: threads.userId,
        title: threads.title,
        content: threads.content,
        hasSolution: threads.hasSolution,
        isPinned: threads.isPinned,
        replyCount: threads.replyCount,
        lastActivityAt: threads.lastActivityAt,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
      })
      .from(threads)
      .leftJoin(users, eq(threads.userId, users.id))
      .where(eq(threads.garageId, garageId))
      .orderBy(desc(threads.isPinned), desc(threads.lastActivityAt));
    
    return garageThreads as (Thread & { userName: string })[];
  }

  async getThread(id: string): Promise<(Thread & { userName: string }) | undefined> {
    const [thread] = await db
      .select({
        id: threads.id,
        garageId: threads.garageId,
        userId: threads.userId,
        title: threads.title,
        content: threads.content,
        hasSolution: threads.hasSolution,
        isPinned: threads.isPinned,
        replyCount: threads.replyCount,
        lastActivityAt: threads.lastActivityAt,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
      })
      .from(threads)
      .leftJoin(users, eq(threads.userId, users.id))
      .where(eq(threads.id, id));
    return thread ? (thread as Thread & { userName: string }) : undefined;
  }

  async createThread(thread: InsertThread, userId: string): Promise<Thread> {
    const [newThread] = await db
      .insert(threads)
      .values({ ...thread, userId })
      .returning();
    return newThread;
  }

  async updateThread(id: string, updates: Partial<{ title: string; content: string; hasSolution: boolean; isPinned: boolean }>): Promise<Thread | undefined> {
    const [updated] = await db
      .update(threads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(threads.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteThread(id: string): Promise<void> {
    await db.delete(threadReplies).where(eq(threadReplies.threadId, id));
    await db.delete(threads).where(eq(threads.id, id));
  }

  async getRepliesByThread(threadId: string): Promise<(ThreadReply & { userName: string })[]> {
    const replies = await db
      .select({
        id: threadReplies.id,
        threadId: threadReplies.threadId,
        userId: threadReplies.userId,
        content: threadReplies.content,
        isSolution: threadReplies.isSolution,
        createdAt: threadReplies.createdAt,
        updatedAt: threadReplies.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
      })
      .from(threadReplies)
      .leftJoin(users, eq(threadReplies.userId, users.id))
      .where(eq(threadReplies.threadId, threadId))
      .orderBy(threadReplies.createdAt);
    
    return replies as (ThreadReply & { userName: string })[];
  }

  async createThreadReply(reply: InsertThreadReply, userId: string): Promise<ThreadReply> {
    const [newReply] = await db
      .insert(threadReplies)
      .values({ ...reply, userId })
      .returning();
    
    await db
      .update(threads)
      .set({ 
        replyCount: sql`${threads.replyCount} + 1`,
        lastActivityAt: new Date(),
      })
      .where(eq(threads.id, reply.threadId));
    
    return newReply;
  }

  async markReplyAsSolution(replyId: string, threadId: string): Promise<void> {
    await db.update(threadReplies).set({ isSolution: false }).where(eq(threadReplies.threadId, threadId));
    await db.update(threadReplies).set({ isSolution: true }).where(eq(threadReplies.id, replyId));
    await db.update(threads).set({ hasSolution: true }).where(eq(threads.id, threadId));
  }

  async getSwapShopListings(): Promise<(SwapShopListing & { userName: string; userSwapCount: number })[]> {
    const listings = await db
      .select({
        id: swapShopListings.id,
        userId: swapShopListings.userId,
        title: swapShopListings.title,
        description: swapShopListings.description,
        price: swapShopListings.price,
        condition: swapShopListings.condition,
        location: swapShopListings.location,
        localPickup: swapShopListings.localPickup,
        willShip: swapShopListings.willShip,
        imageUrl: swapShopListings.imageUrl,
        isActive: swapShopListings.isActive,
        createdAt: swapShopListings.createdAt,
        updatedAt: swapShopListings.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
      })
      .from(swapShopListings)
      .leftJoin(users, eq(swapShopListings.userId, users.id))
      .where(eq(swapShopListings.isActive, true))
      .orderBy(desc(swapShopListings.createdAt));
    
    return listings.map(l => ({ ...l, userSwapCount: 0 })) as (SwapShopListing & { userName: string; userSwapCount: number })[];
  }

  async getSwapShopListing(id: string): Promise<(SwapShopListing & { userName: string; userSwapCount: number }) | undefined> {
    const [listing] = await db
      .select({
        id: swapShopListings.id,
        userId: swapShopListings.userId,
        title: swapShopListings.title,
        description: swapShopListings.description,
        price: swapShopListings.price,
        condition: swapShopListings.condition,
        location: swapShopListings.location,
        localPickup: swapShopListings.localPickup,
        willShip: swapShopListings.willShip,
        imageUrl: swapShopListings.imageUrl,
        isActive: swapShopListings.isActive,
        createdAt: swapShopListings.createdAt,
        updatedAt: swapShopListings.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
      })
      .from(swapShopListings)
      .leftJoin(users, eq(swapShopListings.userId, users.id))
      .where(eq(swapShopListings.id, id));
    
    if (!listing) return undefined;
    return { ...listing, userSwapCount: 0 } as (SwapShopListing & { userName: string; userSwapCount: number });
  }

  async createSwapShopListing(listing: InsertSwapShopListing, userId: string): Promise<SwapShopListing> {
    const [newListing] = await db
      .insert(swapShopListings)
      .values({ ...listing, userId })
      .returning();
    return newListing;
  }

  async updateSwapShopListing(id: string, updates: Partial<InsertSwapShopListing>): Promise<SwapShopListing | undefined> {
    const [updated] = await db
      .update(swapShopListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(swapShopListings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSwapShopListing(id: string): Promise<void> {
    await db.delete(swapShopListings).where(eq(swapShopListings.id, id));
  }

  async getUserSwapShopListings(userId: string): Promise<SwapShopListing[]> {
    return db
      .select()
      .from(swapShopListings)
      .where(eq(swapShopListings.userId, userId))
      .orderBy(desc(swapShopListings.createdAt));
  }
}

export const storage = new DatabaseStorage();
