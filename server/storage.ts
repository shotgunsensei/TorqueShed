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
  diagnosticSessions,
  subscriptions,
  sellerProfiles,
  expertReviews,
  repairPlanExports,
  tools,
  caseToolsUsed,
  shopServices,
  shopLeads,
  shopTeamMembers,
  caseCustomerSummaries,
  type ShopService,
  type InsertShopService,
  type ShopLead,
  type CreateShopLeadInput,
  type ShopTeamMember,
  type ShopTeamRole,
  type CaseCustomerSummary,
  type UpdateShopProfileInput,
  type UpsertCustomerSummaryInput,
  type Tool,
  type InsertTool,
  type CaseToolUsed,
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
  type DiagnosticSession,
  type Subscription,
  type SubscriptionTier,
  type SubscriptionStatus,
  type SellerProfile,
  type SellerType,
  type ExpertReview,
  type ExpertServiceLevel,
  type RepairPlanExport,
  type RepairPlanExportType,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, or, isNull, isNotNull, gt, inArray } from "drizzle-orm";

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
  solutionCount: number;
  listingCount: number;
  vehicleCount: number;
}

export interface UserRecentActivity {
  id: string;
  type: "thread" | "reply";
  title: string;
  garageId: string | null;
  createdAt: string;
}

export interface UserPublicVehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}

export interface FullUserProfile {
  profile: PublicProfile;
  stats: UserStats;
  role: string | null;
  recentActivity: UserRecentActivity[];
  publicVehicles: UserPublicVehicle[];
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getPublicProfile(id: string): Promise<PublicProfile | undefined>;
  updateUserProfile(id: string, updates: ProfileUpdate): Promise<User | undefined>;
  getUserStats(userId: string): Promise<UserStats>;
  getFullUserProfile(userId: string): Promise<FullUserProfile | undefined>;
  getUserSolutionCount(userId: string): Promise<number>;
  
  getGarages(): Promise<Garage[]>;
  getGarage(id: string): Promise<Garage | undefined>;
  joinGarage(userId: string, garageId: string): Promise<void>;
  leaveGarage(userId: string, garageId: string): Promise<void>;
  isGarageMember(userId: string, garageId: string): Promise<boolean>;
  getTopContributors(garageId: string, limit?: number): Promise<{ id: string; username: string; replyCount: number; yearsWrenching: number | null; focusAreas: string[] }[]>;
  
  createReport(report: InsertReport): Promise<Report>;
  
  getApprovedProducts(): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct, createdBy: string): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct> & { submissionStatus?: string; featuredExpiration?: Date | null }): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  incrementProductViews(id: string): Promise<void>;
  incrementProductClicks(id: string): Promise<void>;

  getDiagnosticSessions(userId: string): Promise<DiagnosticSession[]>;
  getDiagnosticSession(id: string): Promise<DiagnosticSession | undefined>;
  createDiagnosticSession(userId: string, data: Partial<DiagnosticSession>): Promise<DiagnosticSession>;
  updateDiagnosticSession(id: string, data: Partial<DiagnosticSession>): Promise<DiagnosticSession | undefined>;
  deleteDiagnosticSession(id: string): Promise<void>;
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
    const [solutionResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(threadReplies)
      .where(and(eq(threadReplies.userId, userId), eq(threadReplies.isSolution, true)));
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
      solutionCount: Number(solutionResult?.count || 0),
      listingCount: Number(listingResult?.count || 0),
      vehicleCount: Number(vehicleResult?.count || 0),
    };
  }

  async getUserSolutionCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(threadReplies)
      .where(and(eq(threadReplies.userId, userId), eq(threadReplies.isSolution, true)));
    return Number(result?.count || 0);
  }

  async getFullUserProfile(userId: string): Promise<FullUserProfile | undefined> {
    const profile = await this.getPublicProfile(userId);
    if (!profile) return undefined;

    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    const stats = await this.getUserStats(userId);

    const recentThreads = await db
      .select({
        id: threads.id,
        title: threads.title,
        garageId: threads.garageId,
        createdAt: threads.createdAt,
      })
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.createdAt))
      .limit(5);

    const recentReplies = await db
      .select({
        id: threadReplies.id,
        threadId: threadReplies.threadId,
        createdAt: threadReplies.createdAt,
      })
      .from(threadReplies)
      .where(eq(threadReplies.userId, userId))
      .orderBy(desc(threadReplies.createdAt))
      .limit(5);

    const replyThreadIds = recentReplies.map(r => r.threadId);
    let replyThreads: { id: string; title: string; garageId: string | null }[] = [];
    if (replyThreadIds.length > 0) {
      replyThreads = await db
        .select({ id: threads.id, title: threads.title, garageId: threads.garageId })
        .from(threads)
        .where(sql`${threads.id} = ANY(ARRAY[${sql.join(replyThreadIds.map(id => sql`${id}`), sql`, `)}])`);
    }

    const recentActivity: UserRecentActivity[] = [
      ...recentThreads.map(t => ({
        id: t.id,
        type: "thread" as const,
        title: t.title,
        garageId: t.garageId,
        createdAt: t.createdAt?.toISOString() || "",
      })),
      ...recentReplies.map(r => {
        const thread = replyThreads.find(t => t.id === r.threadId);
        return {
          id: r.id,
          type: "reply" as const,
          title: thread?.title || "Thread",
          garageId: thread?.garageId || null,
          createdAt: r.createdAt?.toISOString() || "",
        };
      }),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const publicVehicles = await db
      .select({
        id: vehicles.id,
        year: vehicles.year,
        make: vehicles.make,
        model: vehicles.model,
        nickname: vehicles.nickname,
      })
      .from(vehicles)
      .where(and(eq(vehicles.userId, userId), eq(vehicles.isPublic, true)))
      .orderBy(desc(vehicles.createdAt))
      .limit(10);

    return {
      profile,
      stats,
      role: user?.role || null,
      recentActivity,
      publicVehicles,
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

  async getTopContributors(garageId: string, limit = 5): Promise<{ id: string; username: string; replyCount: number; yearsWrenching: number | null; focusAreas: string[] }[]> {
    const garageThreadIds = db
      .select({ id: threads.id })
      .from(threads)
      .where(eq(threads.garageId, garageId));

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        replyCount: sql<number>`count(${threadReplies.id})::int`,
        yearsWrenching: users.yearsWrenching,
        focusAreas: sql<string[]>`${users.focusAreas}::jsonb`,
      })
      .from(threadReplies)
      .innerJoin(users, eq(threadReplies.userId, users.id))
      .where(inArray(threadReplies.threadId, garageThreadIds))
      .groupBy(users.id, users.username, users.yearsWrenching, sql`${users.focusAreas}::jsonb`)
      .orderBy(sql`count(${threadReplies.id}) DESC`)
      .limit(limit);

    return results as { id: string; username: string; replyCount: number; yearsWrenching: number | null; focusAreas: string[] }[];
  }

  async getGarages(): Promise<(Garage & { threadCount: number; latestActivityAt: string | null })[]> {
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
      const [latestResult] = await db
        .select({ latest: sql<string>`MAX(${threads.lastActivityAt})` })
        .from(threads)
        .where(eq(threads.garageId, garage.id));
      return {
        ...garage,
        memberCount: Number(memberResult?.count || 0),
        threadCount: Number(threadResult?.count || 0),
        latestActivityAt: latestResult?.latest || null,
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
      const [costResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(CAST(NULLIF(cost, '') AS NUMERIC)), 0)` })
        .from(vehicleNotes)
        .where(eq(vehicleNotes.vehicleId, vehicle.id));
      return {
        ...vehicle,
        notesCount: Number(countResult?.count || 0),
        totalCost: costResult?.total || "0",
      };
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

  async getThreadsByGarage(garageId: string): Promise<(Thread & { userName: string; yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number; vehicleName: string | null })[]> {
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
        vehicleId: threads.vehicleId,
        symptoms: threads.symptoms,
        obdCodes: threads.obdCodes,
        severity: threads.severity,
        drivability: threads.drivability,
        recentChanges: threads.recentChanges,
        status: threads.status,
        systemCategory: threads.systemCategory,
        urgency: threads.urgency,
        budget: threads.budget,
        toolsAvailable: threads.toolsAvailable,
        whenItHappens: threads.whenItHappens,
        partsReplaced: threads.partsReplaced,
        rootCause: threads.rootCause,
        finalFix: threads.finalFix,
        partsUsed: threads.partsUsed,
        toolsUsed: threads.toolsUsed,
        solvedCost: threads.solvedCost,
        laborMinutes: threads.laborMinutes,
        verificationNotes: threads.verificationNotes,
        lastActivityAt: threads.lastActivityAt,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
        yearsWrenching: users.yearsWrenching,
        focusAreas: users.focusAreas,
        solutionCountTotal: sql<number>`(SELECT COUNT(*) FROM thread_replies r2 WHERE r2.user_id = ${threads.userId} AND r2.is_solution = true)::int`,
        vehicleName: sql<string | null>`(SELECT CONCAT(${vehicles.year}, ' ', ${vehicles.make}, ' ', ${vehicles.model}) FROM ${vehicles} WHERE ${vehicles.id} = ${threads.vehicleId})`,
      })
      .from(threads)
      .leftJoin(users, eq(threads.userId, users.id))
      .where(eq(threads.garageId, garageId))
      .orderBy(desc(threads.isPinned), desc(threads.lastActivityAt));
    
    return garageThreads as (Thread & { userName: string; yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number; vehicleName: string | null })[];
  }

  async getAllThreads(): Promise<(Thread & { userName: string; yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number; vehicleName: string | null })[]> {
    const allThreads = await db
      .select({
        id: threads.id,
        garageId: threads.garageId,
        userId: threads.userId,
        title: threads.title,
        content: threads.content,
        hasSolution: threads.hasSolution,
        isPinned: threads.isPinned,
        replyCount: threads.replyCount,
        vehicleId: threads.vehicleId,
        symptoms: threads.symptoms,
        obdCodes: threads.obdCodes,
        severity: threads.severity,
        drivability: threads.drivability,
        recentChanges: threads.recentChanges,
        status: threads.status,
        systemCategory: threads.systemCategory,
        urgency: threads.urgency,
        budget: threads.budget,
        toolsAvailable: threads.toolsAvailable,
        whenItHappens: threads.whenItHappens,
        partsReplaced: threads.partsReplaced,
        rootCause: threads.rootCause,
        finalFix: threads.finalFix,
        partsUsed: threads.partsUsed,
        toolsUsed: threads.toolsUsed,
        solvedCost: threads.solvedCost,
        laborMinutes: threads.laborMinutes,
        verificationNotes: threads.verificationNotes,
        lastActivityAt: threads.lastActivityAt,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
        yearsWrenching: users.yearsWrenching,
        focusAreas: users.focusAreas,
        solutionCountTotal: sql<number>`(SELECT COUNT(*) FROM thread_replies r2 WHERE r2.user_id = ${threads.userId} AND r2.is_solution = true)::int`,
        vehicleName: sql<string | null>`(SELECT CONCAT(${vehicles.year}, ' ', ${vehicles.make}, ' ', ${vehicles.model}) FROM ${vehicles} WHERE ${vehicles.id} = ${threads.vehicleId})`,
      })
      .from(threads)
      .leftJoin(users, eq(threads.userId, users.id))
      .orderBy(desc(threads.isPinned), desc(threads.lastActivityAt));

    return allThreads as (Thread & { userName: string; yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number; vehicleName: string | null })[];
  }

  async getSolvedThreads(): Promise<(Thread & { vehicleName: string | null })[]> {
    const rows = await db
      .select({
        id: threads.id,
        garageId: threads.garageId,
        userId: threads.userId,
        title: threads.title,
        content: threads.content,
        hasSolution: threads.hasSolution,
        isPinned: threads.isPinned,
        replyCount: threads.replyCount,
        vehicleId: threads.vehicleId,
        symptoms: threads.symptoms,
        obdCodes: threads.obdCodes,
        severity: threads.severity,
        drivability: threads.drivability,
        recentChanges: threads.recentChanges,
        status: threads.status,
        systemCategory: threads.systemCategory,
        urgency: threads.urgency,
        budget: threads.budget,
        toolsAvailable: threads.toolsAvailable,
        whenItHappens: threads.whenItHappens,
        partsReplaced: threads.partsReplaced,
        rootCause: threads.rootCause,
        finalFix: threads.finalFix,
        partsUsed: threads.partsUsed,
        toolsUsed: threads.toolsUsed,
        solvedCost: threads.solvedCost,
        laborMinutes: threads.laborMinutes,
        verificationNotes: threads.verificationNotes,
        lastActivityAt: threads.lastActivityAt,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        vehicleName: sql<string | null>`(SELECT CONCAT(${vehicles.year}, ' ', ${vehicles.make}, ' ', ${vehicles.model}) FROM ${vehicles} WHERE ${vehicles.id} = ${threads.vehicleId})`,
      })
      .from(threads)
      .where(
        or(
          eq(threads.hasSolution, true),
          eq(threads.status, "solved"),
          isNotNull(threads.finalFix),
        ),
      )
      .orderBy(desc(threads.lastActivityAt));
    return rows as (Thread & { vehicleName: string | null })[];
  }

  async getThread(id: string): Promise<(Thread & { userName: string; yearsWrenching: number | null; focusAreas: string[]; vehicleName: string | null }) | undefined> {
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
        vehicleId: threads.vehicleId,
        symptoms: threads.symptoms,
        obdCodes: threads.obdCodes,
        severity: threads.severity,
        drivability: threads.drivability,
        recentChanges: threads.recentChanges,
        status: threads.status,
        systemCategory: threads.systemCategory,
        urgency: threads.urgency,
        budget: threads.budget,
        toolsAvailable: threads.toolsAvailable,
        whenItHappens: threads.whenItHappens,
        partsReplaced: threads.partsReplaced,
        rootCause: threads.rootCause,
        finalFix: threads.finalFix,
        partsUsed: threads.partsUsed,
        toolsUsed: threads.toolsUsed,
        solvedCost: threads.solvedCost,
        laborMinutes: threads.laborMinutes,
        verificationNotes: threads.verificationNotes,
        lastActivityAt: threads.lastActivityAt,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
        yearsWrenching: users.yearsWrenching,
        focusAreas: users.focusAreas,
        vehicleName: sql<string | null>`(SELECT CONCAT(${vehicles.year}, ' ', ${vehicles.make}, ' ', ${vehicles.model}) FROM ${vehicles} WHERE ${vehicles.id} = ${threads.vehicleId})`,
      })
      .from(threads)
      .leftJoin(users, eq(threads.userId, users.id))
      .where(eq(threads.id, id));
    return thread ? (thread as Thread & { userName: string; yearsWrenching: number | null; focusAreas: string[]; vehicleName: string | null }) : undefined;
  }

  async createThread(thread: InsertThread, userId: string): Promise<Thread> {
    const [newThread] = await db
      .insert(threads)
      .values({ ...thread, userId })
      .returning();
    return newThread;
  }

  async updateThread(id: string, updates: Partial<{ title: string; content: string; hasSolution: boolean; isPinned: boolean; status: string; systemCategory: string | null; urgency: string | null }>): Promise<Thread | undefined> {
    const [updated] = await db
      .update(threads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(threads.id, id))
      .returning();
    return updated || undefined;
  }

  async markThreadSolved(threadId: string, replyId: string | null, fix: { rootCause: string; finalFix: string; partsUsed: string[] | null; toolsUsed: string[] | null; solvedCost: string | null; laborMinutes: number | null; verificationNotes: string | null }): Promise<void> {
    await db.transaction(async (tx) => {
      if (replyId) {
        await tx
          .update(threadReplies)
          .set({ isSolution: false, replyType: "comment" })
          .where(and(eq(threadReplies.threadId, threadId), eq(threadReplies.isSolution, true)));
        await tx
          .update(threadReplies)
          .set({ isSolution: true, replyType: "confirmed_fix" })
          .where(and(eq(threadReplies.id, replyId), eq(threadReplies.threadId, threadId)));
      }
      await tx.update(threads).set({
        hasSolution: true,
        status: "solved",
        rootCause: fix.rootCause,
        finalFix: fix.finalFix,
        partsUsed: fix.partsUsed,
        toolsUsed: fix.toolsUsed,
        solvedCost: fix.solvedCost,
        laborMinutes: fix.laborMinutes,
        verificationNotes: fix.verificationNotes,
        updatedAt: new Date(),
      }).where(eq(threads.id, threadId));
    });
  }

  async deleteThread(id: string): Promise<void> {
    await db.delete(threadReplies).where(eq(threadReplies.threadId, id));
    await db.delete(threads).where(eq(threads.id, id));
  }

  async getRepliesByThread(threadId: string): Promise<(ThreadReply & { userName: string; yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number })[]> {
    const replies = await db
      .select({
        id: threadReplies.id,
        threadId: threadReplies.threadId,
        userId: threadReplies.userId,
        content: threadReplies.content,
        replyType: threadReplies.replyType,
        isSolution: threadReplies.isSolution,
        solutionDifficulty: threadReplies.solutionDifficulty,
        solutionCost: threadReplies.solutionCost,
        solutionTools: threadReplies.solutionTools,
        solutionParts: threadReplies.solutionParts,
        createdAt: threadReplies.createdAt,
        updatedAt: threadReplies.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
        yearsWrenching: users.yearsWrenching,
        focusAreas: sql<string[]>`COALESCE(${users.focusAreas}, '[]'::json)`,
        solutionCountTotal: sql<number>`(SELECT COUNT(*) FROM thread_replies r2 WHERE r2.user_id = ${threadReplies.userId} AND r2.is_solution = true)::int`,
        replierTier: sql<string>`COALESCE((SELECT tier FROM subscriptions s WHERE s.user_id = ${threadReplies.userId} AND s.status IN ('active','trialing') ORDER BY s.updated_at DESC NULLS LAST LIMIT 1), 'free')`,
      })
      .from(threadReplies)
      .leftJoin(users, eq(threadReplies.userId, users.id))
      .where(eq(threadReplies.threadId, threadId))
      .orderBy(threadReplies.createdAt);

    const PRIORITY_TIERS = new Set(["diy_pro", "garage_pro", "shop_pro"]);
    const enriched = replies.map((r) => ({
      ...r,
      isPriority: PRIORITY_TIERS.has(r.replierTier),
    }));

    enriched.sort((a, b) => {
      if (a.isPriority !== b.isPriority) {
        return a.isPriority ? -1 : 1;
      }
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aDate - bDate;
    });

    return enriched as (ThreadReply & { userName: string; yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number; replierTier: string; isPriority: boolean })[];
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

  async markReplyAsSolution(replyId: string, threadId: string, meta?: { solutionDifficulty: number | null; solutionCost: string | null; solutionTools: string[] | null; solutionParts: string[] | null }): Promise<void> {
    await db.update(threadReplies).set({ isSolution: false, solutionDifficulty: null, solutionCost: null, solutionTools: null, solutionParts: null }).where(eq(threadReplies.threadId, threadId));
    await db.update(threadReplies).set({ 
      isSolution: true,
      ...(meta?.solutionDifficulty !== undefined ? { solutionDifficulty: meta.solutionDifficulty } : {}),
      ...(meta?.solutionCost !== undefined ? { solutionCost: meta.solutionCost } : {}),
      ...(meta?.solutionTools !== undefined ? { solutionTools: meta.solutionTools } : {}),
      ...(meta?.solutionParts !== undefined ? { solutionParts: meta.solutionParts } : {}),
    }).where(eq(threadReplies.id, replyId));
    await db.update(threads).set({ hasSolution: true }).where(eq(threads.id, threadId));
  }

  async getSwapShopListings(): Promise<(SwapShopListing & { userName: string; userSwapCount: number; sellerJoinDate: string | null; sellerListingCount: number })[]> {
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
        sellerJoinDate: sql<string | null>`${users.createdAt}::text`,
        sellerListingCount: sql<number>`(SELECT COUNT(*) FROM swap_shop_listings s2 WHERE s2.user_id = ${swapShopListings.userId} AND s2.is_active = true)::int`,
      })
      .from(swapShopListings)
      .leftJoin(users, eq(swapShopListings.userId, users.id))
      .where(and(eq(swapShopListings.isActive, true), eq(swapShopListings.isDraft, false)))
      .orderBy(desc(swapShopListings.createdAt));
    
    return listings.map(l => ({ ...l, userSwapCount: 0 })) as (SwapShopListing & { userName: string; userSwapCount: number; sellerJoinDate: string | null; sellerListingCount: number })[];
  }

  async getSwapShopListing(id: string): Promise<(SwapShopListing & { userName: string; userSwapCount: number; sellerJoinDate: string | null; sellerListingCount: number }) | undefined> {
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
        extraImageUrls: swapShopListings.extraImageUrls,
        isActive: swapShopListings.isActive,
        isDraft: swapShopListings.isDraft,
        contactMethod: swapShopListings.contactMethod,
        category: swapShopListings.category,
        attachedCaseId: swapShopListings.attachedCaseId,
        isRecommendedForCase: swapShopListings.isRecommendedForCase,
        createdAt: swapShopListings.createdAt,
        updatedAt: swapShopListings.updatedAt,
        userName: sql<string>`COALESCE(${users.username}, 'Unknown')`,
        sellerJoinDate: sql<string | null>`(SELECT created_at FROM users WHERE id = ${swapShopListings.userId})`,
        sellerListingCount: sql<number>`(SELECT count(*)::int FROM swap_shop_listings WHERE user_id = ${swapShopListings.userId})`,
      })
      .from(swapShopListings)
      .leftJoin(users, eq(swapShopListings.userId, users.id))
      .where(eq(swapShopListings.id, id));
    
    if (!listing) return undefined;
    return { ...listing, userSwapCount: listing.sellerListingCount || 0 } as (SwapShopListing & { userName: string; userSwapCount: number; sellerJoinDate: string | null; sellerListingCount: number });
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

  async getDiagnosticSessions(userId: string): Promise<DiagnosticSession[]> {
    return db
      .select()
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.userId, userId))
      .orderBy(desc(diagnosticSessions.updatedAt));
  }

  async getDiagnosticSession(id: string): Promise<DiagnosticSession | undefined> {
    const [session] = await db
      .select()
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.id, id));
    return session || undefined;
  }

  async createDiagnosticSession(userId: string, data: Partial<DiagnosticSession>): Promise<DiagnosticSession> {
    const [session] = await db
      .insert(diagnosticSessions)
      .values({
        userId,
        vehicleYear: data.vehicleYear,
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehicleEngine: data.vehicleEngine,
        vehicleMileage: data.vehicleMileage,
        vehicleVin: data.vehicleVin,
        categoryId: data.categoryId,
        phase: data.phase || "intake",
        answers: data.answers || {},
        completedTests: data.completedTests || {},
        dtcCodes: data.dtcCodes || [],
        recentRepairs: data.recentRepairs || "",
        notes: data.notes || "",
        status: "active",
      })
      .returning();
    return session;
  }

  async updateDiagnosticSession(id: string, data: Partial<DiagnosticSession>): Promise<DiagnosticSession | undefined> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.vehicleYear !== undefined) updates.vehicleYear = data.vehicleYear;
    if (data.vehicleMake !== undefined) updates.vehicleMake = data.vehicleMake;
    if (data.vehicleModel !== undefined) updates.vehicleModel = data.vehicleModel;
    if (data.vehicleEngine !== undefined) updates.vehicleEngine = data.vehicleEngine;
    if (data.vehicleMileage !== undefined) updates.vehicleMileage = data.vehicleMileage;
    if (data.vehicleVin !== undefined) updates.vehicleVin = data.vehicleVin;
    if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
    if (data.phase !== undefined) updates.phase = data.phase;
    if (data.answers !== undefined) updates.answers = data.answers;
    if (data.completedTests !== undefined) updates.completedTests = data.completedTests;
    if (data.dtcCodes !== undefined) updates.dtcCodes = data.dtcCodes;
    if (data.recentRepairs !== undefined) updates.recentRepairs = data.recentRepairs;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.status !== undefined) updates.status = data.status;

    const [updated] = await db
      .update(diagnosticSessions)
      .set(updates)
      .where(eq(diagnosticSessions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDiagnosticSession(id: string): Promise<void> {
    await db.delete(diagnosticSessions).where(eq(diagnosticSessions.id, id));
  }

  // ========== Subscriptions ==========
  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    return sub || undefined;
  }

  async upsertSubscription(userId: string, tier: SubscriptionTier, status: SubscriptionStatus = "active"): Promise<Subscription> {
    const existing = await this.getSubscription(userId);
    if (existing) {
      const [updated] = await db
        .update(subscriptions)
        .set({ tier, status, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(subscriptions)
      .values({ userId, tier, status })
      .returning();
    return created;
  }

  // ========== Seller Profiles ==========
  async getSellerProfile(userId: string): Promise<SellerProfile | undefined> {
    const [sp] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);
    return sp || undefined;
  }

  async upsertSellerProfile(userId: string, data: { displayName: string; sellerType: SellerType; bio: string | null; location: string | null }): Promise<SellerProfile> {
    const existing = await this.getSellerProfile(userId);
    if (existing) {
      const [updated] = await db
        .update(sellerProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(sellerProfiles.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(sellerProfiles)
      .values({ userId, ...data })
      .returning();
    return created;
  }

  async getSellerDashboard(userId: string): Promise<{
    profile: SellerProfile | undefined;
    activeListings: SwapShopListing[];
    draftListings: SwapShopListing[];
    attachedCaseCount: number;
  }> {
    const profile = await this.getSellerProfile(userId);
    const all = await db
      .select()
      .from(swapShopListings)
      .where(eq(swapShopListings.userId, userId))
      .orderBy(desc(swapShopListings.updatedAt));
    const activeListings = all.filter((l) => l.isActive && !l.isDraft);
    const draftListings = all.filter((l) => l.isDraft);
    const attachedCaseCount = all.filter((l) => l.attachedCaseId).length;
    return { profile, activeListings, draftListings, attachedCaseCount };
  }

  // ========== Expert Reviews ==========
  async createExpertReview(
    caseId: string,
    userId: string,
    serviceLevel: ExpertServiceLevel,
    userNotes: string | null,
    priceCents: number,
  ): Promise<ExpertReview> {
    const [created] = await db
      .insert(expertReviews)
      .values({
        caseId,
        userId,
        serviceLevel,
        userNotes,
        priceCents,
        status: "requested",
        paymentStatus: "pending",
      })
      .returning();
    return created;
  }

  async getExpertReviewsByCase(caseId: string): Promise<ExpertReview[]> {
    return db
      .select()
      .from(expertReviews)
      .where(eq(expertReviews.caseId, caseId))
      .orderBy(desc(expertReviews.createdAt));
  }

  // ========== Repair Plan Exports ==========
  async createRepairPlanExport(
    caseId: string,
    userId: string,
    exportType: RepairPlanExportType,
    payload: unknown,
  ): Promise<RepairPlanExport> {
    const [created] = await db
      .insert(repairPlanExports)
      .values({ caseId, userId, exportType, payload: payload as never, status: "ready" })
      .returning();
    return created;
  }

  // ========== Marketplace listings (extended) ==========
  async getListingsByUser(userId: string): Promise<SwapShopListing[]> {
    return db
      .select()
      .from(swapShopListings)
      .where(eq(swapShopListings.userId, userId))
      .orderBy(desc(swapShopListings.updatedAt));
  }

  async getListingsForCase(caseId: string): Promise<SwapShopListing[]> {
    return db
      .select()
      .from(swapShopListings)
      .where(
        and(
          eq(swapShopListings.attachedCaseId, caseId),
          eq(swapShopListings.isActive, true),
          eq(swapShopListings.isDraft, false),
        ),
      )
      .orderBy(desc(swapShopListings.updatedAt));
  }

  async getActiveListingsByUser(userId: string): Promise<SwapShopListing[]> {
    return db
      .select()
      .from(swapShopListings)
      .where(and(eq(swapShopListings.userId, userId), eq(swapShopListings.isActive, true)))
      .orderBy(desc(swapShopListings.updatedAt));
  }

  // ========== Tool Inventory ==========
  async getToolsByUser(userId: string): Promise<Tool[]> {
    return db
      .select()
      .from(tools)
      .where(eq(tools.userId, userId))
      .orderBy(desc(tools.updatedAt));
  }

  async getTool(id: string): Promise<Tool | undefined> {
    const [tool] = await db.select().from(tools).where(eq(tools.id, id)).limit(1);
    return tool;
  }

  async createTool(data: InsertTool, userId: string): Promise<Tool> {
    const [created] = await db
      .insert(tools)
      .values({ ...data, userId })
      .returning();
    return created;
  }

  async updateTool(id: string, updates: Partial<InsertTool>): Promise<Tool> {
    const [updated] = await db
      .update(tools)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tools.id, id))
      .returning();
    return updated;
  }

  async deleteTool(id: string): Promise<void> {
    await db.delete(tools).where(eq(tools.id, id));
  }

  // ========== Case Tools Used ==========
  async getToolsUsedForCase(caseId: string): Promise<(CaseToolUsed & { tool: Tool | null })[]> {
    const rows = await db
      .select({
        link: caseToolsUsed,
        tool: tools,
      })
      .from(caseToolsUsed)
      .leftJoin(tools, eq(caseToolsUsed.toolId, tools.id))
      .where(eq(caseToolsUsed.caseId, caseId))
      .orderBy(desc(caseToolsUsed.createdAt));
    return rows.map((r) => ({ ...r.link, tool: r.tool }));
  }

  async getCaseToolUsed(linkId: string): Promise<CaseToolUsed | undefined> {
    const [row] = await db.select().from(caseToolsUsed).where(eq(caseToolsUsed.id, linkId)).limit(1);
    return row;
  }

  async attachToolToCase(caseId: string, toolId: string, attachedBy: string): Promise<CaseToolUsed> {
    const [created] = await db
      .insert(caseToolsUsed)
      .values({ caseId, toolId, attachedBy })
      .returning();
    return created;
  }

  async detachToolFromCase(linkId: string): Promise<void> {
    await db.delete(caseToolsUsed).where(eq(caseToolsUsed.id, linkId));
  }

  // ========== Maintenance Due ==========
  async getMaintenanceDueForUser(userId: string) {
    const userVehicles = await this.getVehiclesByUser(userId);
    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const items: Array<{
      noteId: string;
      vehicleId: string;
      vehicleName: string;
      title: string;
      type: string;
      nextDueDate: Date | null;
      nextDueMileage: number | null;
      currentMileage: number | null;
      daysRemaining: number | null;
      milesRemaining: number | null;
      isOverdue: boolean;
    }> = [];

    for (const v of userVehicles) {
      const notes = await this.getNotesByVehicle(v.id);
      const sortedByMileage = [...notes].filter((n) => n.mileage !== null).sort((a, b) => (b.mileage ?? 0) - (a.mileage ?? 0));
      const currentMileage = sortedByMileage[0]?.mileage ?? null;

      for (const n of notes) {
        let isDue = false;
        let isOverdue = false;
        let daysRemaining: number | null = null;
        let milesRemaining: number | null = null;

        if (n.nextDueDate) {
          const due = new Date(n.nextDueDate as unknown as string);
          if (due <= inThirtyDays) {
            isDue = true;
            daysRemaining = Math.round((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
            if (due <= now) isOverdue = true;
          }
        }
        if (n.nextDueMileage && currentMileage !== null) {
          const diff = n.nextDueMileage - currentMileage;
          if (diff <= 1000) {
            isDue = true;
            milesRemaining = diff;
            if (diff <= 0) isOverdue = true;
          }
        }
        if (isDue) {
          items.push({
            noteId: n.id,
            vehicleId: v.id,
            vehicleName: v.nickname || `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || "Vehicle",
            title: n.title,
            type: n.type ?? "general",
            nextDueDate: n.nextDueDate as Date | null,
            nextDueMileage: n.nextDueMileage,
            currentMileage,
            daysRemaining,
            milesRemaining,
            isOverdue,
          });
        }
      }
    }

    items.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const aMin = Math.min(a.daysRemaining ?? Infinity, a.milesRemaining ?? Infinity);
      const bMin = Math.min(b.daysRemaining ?? Infinity, b.milesRemaining ?? Infinity);
      return aMin - bMin;
    });

    return items;
  }

  // ========== Shop Pro: Profile ==========
  async getShopProfileBySlug(slug: string): Promise<SellerProfile | undefined> {
    const [sp] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.slug, slug)).limit(1);
    return sp || undefined;
  }

  async isSlugAvailable(slug: string, excludeUserId?: string): Promise<boolean> {
    const existing = await this.getShopProfileBySlug(slug);
    if (!existing) return true;
    if (excludeUserId && existing.userId === excludeUserId) return true;
    return false;
  }

  async upsertShopFields(userId: string, data: UpdateShopProfileInput): Promise<SellerProfile> {
    const existing = await this.getSellerProfile(userId);
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (typeof v === "string" && v === "" && (k === "logoUrl" || k === "email" || k === "website")) {
        cleaned[k] = null;
      } else {
        cleaned[k] = v;
      }
    }
    if (existing) {
      const [updated] = await db
        .update(sellerProfiles)
        .set({ ...cleaned, updatedAt: new Date() })
        .where(eq(sellerProfiles.userId, userId))
        .returning();
      return updated;
    }
    const displayName = (cleaned.displayName as string) || "My Shop";
    const sellerType = (cleaned.sellerType as string) || "shop";
    const [created] = await db
      .insert(sellerProfiles)
      .values({ userId, displayName, sellerType, ...cleaned })
      .returning();
    return created;
  }

  // ========== Shop Pro: Services ==========
  async listShopServices(ownerUserId: string): Promise<ShopService[]> {
    return db
      .select()
      .from(shopServices)
      .where(eq(shopServices.ownerUserId, ownerUserId))
      .orderBy(desc(shopServices.updatedAt));
  }

  async listPublicShopServices(ownerUserId: string): Promise<ShopService[]> {
    return db
      .select()
      .from(shopServices)
      .where(and(eq(shopServices.ownerUserId, ownerUserId), eq(shopServices.isActive, true)))
      .orderBy(desc(shopServices.updatedAt));
  }

  async getShopService(id: string): Promise<ShopService | undefined> {
    const [s] = await db.select().from(shopServices).where(eq(shopServices.id, id)).limit(1);
    return s || undefined;
  }

  async createShopService(ownerUserId: string, data: InsertShopService): Promise<ShopService> {
    const [created] = await db
      .insert(shopServices)
      .values({
        ownerUserId,
        name: data.name,
        category: data.category ?? "repair",
        description: data.description ?? null,
        startingPrice: data.startingPrice ?? null,
        eta: data.eta ?? null,
        isActive: data.isActive ?? true,
      })
      .returning();
    return created;
  }

  async updateShopService(id: string, updates: Partial<InsertShopService>): Promise<ShopService> {
    const [updated] = await db
      .update(shopServices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shopServices.id, id))
      .returning();
    return updated;
  }

  async deleteShopService(id: string): Promise<void> {
    await db.delete(shopServices).where(eq(shopServices.id, id));
  }

  // ========== Shop Pro: Leads ==========
  async createShopLead(ownerUserId: string, data: CreateShopLeadInput): Promise<ShopLead> {
    const [created] = await db
      .insert(shopLeads)
      .values({
        ownerUserId,
        customerName: data.customerName,
        email: data.email && data.email !== "" ? data.email : null,
        phone: data.phone ?? null,
        vehicle: data.vehicle ?? null,
        issue: data.issue,
        preferredContact: data.preferredContact ?? "email",
        serviceId: data.serviceId ?? null,
      })
      .returning();
    return created;
  }

  async listShopLeads(ownerUserId: string): Promise<ShopLead[]> {
    return db
      .select()
      .from(shopLeads)
      .where(eq(shopLeads.ownerUserId, ownerUserId))
      .orderBy(desc(shopLeads.createdAt));
  }

  async listAccessibleShopLeads(userId: string): Promise<ShopLead[]> {
    const teamOwners = await this.getOwnersForTeamMember(userId);
    const ownerIds = Array.from(new Set([userId, ...teamOwners.map((t) => t.ownerUserId)]));
    return db
      .select()
      .from(shopLeads)
      .where(inArray(shopLeads.ownerUserId, ownerIds))
      .orderBy(desc(shopLeads.createdAt));
  }

  async getAccessibleUnreadLeadCount(userId: string): Promise<number> {
    const teamOwners = await this.getOwnersForTeamMember(userId);
    const ownerIds = Array.from(new Set([userId, ...teamOwners.map((t) => t.ownerUserId)]));
    const rows = await db
      .select({ id: shopLeads.id })
      .from(shopLeads)
      .where(and(inArray(shopLeads.ownerUserId, ownerIds), eq(shopLeads.isRead, false)));
    return rows.length;
  }

  async getShopLead(id: string): Promise<ShopLead | undefined> {
    const [l] = await db.select().from(shopLeads).where(eq(shopLeads.id, id)).limit(1);
    return l || undefined;
  }

  async markLeadRead(id: string, isRead: boolean): Promise<ShopLead> {
    const [updated] = await db
      .update(shopLeads)
      .set({ isRead })
      .where(eq(shopLeads.id, id))
      .returning();
    return updated;
  }

  async getUnreadLeadCount(ownerUserId: string): Promise<number> {
    const rows = await db
      .select({ id: shopLeads.id })
      .from(shopLeads)
      .where(and(eq(shopLeads.ownerUserId, ownerUserId), eq(shopLeads.isRead, false)));
    return rows.length;
  }

  // ========== Shop Pro: Team ==========
  async listTeamMembers(ownerUserId: string): Promise<(ShopTeamMember & { username: string })[]> {
    const rows = await db
      .select({
        id: shopTeamMembers.id,
        ownerUserId: shopTeamMembers.ownerUserId,
        memberUserId: shopTeamMembers.memberUserId,
        role: shopTeamMembers.role,
        createdAt: shopTeamMembers.createdAt,
        username: users.username,
      })
      .from(shopTeamMembers)
      .leftJoin(users, eq(users.id, shopTeamMembers.memberUserId))
      .where(eq(shopTeamMembers.ownerUserId, ownerUserId))
      .orderBy(desc(shopTeamMembers.createdAt));
    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.ownerUserId,
      memberUserId: r.memberUserId,
      role: r.role,
      createdAt: r.createdAt,
      username: r.username ?? "(unknown)",
    }));
  }

  async addTeamMember(ownerUserId: string, memberUserId: string, role: ShopTeamRole): Promise<ShopTeamMember> {
    const existing = await db
      .select()
      .from(shopTeamMembers)
      .where(and(eq(shopTeamMembers.ownerUserId, ownerUserId), eq(shopTeamMembers.memberUserId, memberUserId)))
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(shopTeamMembers)
        .set({ role })
        .where(eq(shopTeamMembers.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(shopTeamMembers)
      .values({ ownerUserId, memberUserId, role })
      .returning();
    return created;
  }

  async removeTeamMember(ownerUserId: string, memberId: string): Promise<void> {
    await db
      .delete(shopTeamMembers)
      .where(and(eq(shopTeamMembers.id, memberId), eq(shopTeamMembers.ownerUserId, ownerUserId)));
  }

  async getTeamRole(ownerUserId: string, memberUserId: string): Promise<ShopTeamRole | null> {
    const [row] = await db
      .select({ role: shopTeamMembers.role })
      .from(shopTeamMembers)
      .where(and(eq(shopTeamMembers.ownerUserId, ownerUserId), eq(shopTeamMembers.memberUserId, memberUserId)))
      .limit(1);
    return (row?.role as ShopTeamRole | undefined) ?? null;
  }

  async getOwnersForTeamMember(memberUserId: string): Promise<{ ownerUserId: string; role: ShopTeamRole }[]> {
    const rows = await db
      .select({ ownerUserId: shopTeamMembers.ownerUserId, role: shopTeamMembers.role })
      .from(shopTeamMembers)
      .where(eq(shopTeamMembers.memberUserId, memberUserId));
    return rows.map((r) => ({ ownerUserId: r.ownerUserId, role: r.role as ShopTeamRole }));
  }

  // ========== Shop Pro: Customer Summaries ==========
  async getCustomerSummaryByCase(caseId: string): Promise<CaseCustomerSummary | undefined> {
    const [s] = await db
      .select()
      .from(caseCustomerSummaries)
      .where(eq(caseCustomerSummaries.caseId, caseId))
      .limit(1);
    return s || undefined;
  }

  async getCustomerSummaryByToken(token: string): Promise<CaseCustomerSummary | undefined> {
    const [s] = await db
      .select()
      .from(caseCustomerSummaries)
      .where(eq(caseCustomerSummaries.token, token))
      .limit(1);
    return s || undefined;
  }

  async upsertCustomerSummary(
    caseId: string,
    ownerUserId: string,
    data: UpsertCustomerSummaryInput,
    newToken: string,
  ): Promise<CaseCustomerSummary> {
    const existing = await this.getCustomerSummaryByCase(caseId);
    if (existing) {
      const updates: Record<string, unknown> = {
        customerConcern: data.customerConcern ?? null,
        diagnosticFindings: data.diagnosticFindings ?? null,
        recommendedRepairs: data.recommendedRepairs ?? null,
        urgencyLevel: data.urgencyLevel,
        estimateNotes: data.estimateNotes ?? null,
        nextSteps: data.nextSteps ?? null,
        isRevoked: false,
        updatedAt: new Date(),
      };
      if (existing.isRevoked) {
        updates.token = newToken;
      }
      const [updated] = await db
        .update(caseCustomerSummaries)
        .set(updates)
        .where(eq(caseCustomerSummaries.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(caseCustomerSummaries)
      .values({
        caseId,
        ownerUserId,
        token: newToken,
        customerConcern: data.customerConcern ?? null,
        diagnosticFindings: data.diagnosticFindings ?? null,
        recommendedRepairs: data.recommendedRepairs ?? null,
        urgencyLevel: data.urgencyLevel,
        estimateNotes: data.estimateNotes ?? null,
        nextSteps: data.nextSteps ?? null,
        isRevoked: false,
      })
      .returning();
    return created;
  }

  async revokeCustomerSummary(caseId: string): Promise<void> {
    await db
      .update(caseCustomerSummaries)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(eq(caseCustomerSummaries.caseId, caseId));
  }

  async rotateCustomerSummaryToken(caseId: string, newToken: string): Promise<CaseCustomerSummary | undefined> {
    const [updated] = await db
      .update(caseCustomerSummaries)
      .set({ token: newToken, isRevoked: false, updatedAt: new Date() })
      .where(eq(caseCustomerSummaries.caseId, caseId))
      .returning();
    return updated;
  }

  // ========== Shop Pro: Credibility ==========
  async getShopCredibility(ownerUserId: string): Promise<{
    solvedCases: number;
    activeListings: number;
    services: number;
    threads: number;
    yearsWrenching: number | null;
  }> {
    const solvedRows = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.userId, ownerUserId), eq(threads.hasSolution, true)));
    const allThreads = await db
      .select({ id: threads.id })
      .from(threads)
      .where(eq(threads.userId, ownerUserId));
    const listings = await this.getActiveListingsByUser(ownerUserId);
    const services = await this.listPublicShopServices(ownerUserId);
    const [u] = await db
      .select({ yearsWrenching: users.yearsWrenching })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);
    return {
      solvedCases: solvedRows.length,
      activeListings: listings.length,
      services: services.length,
      threads: allThreads.length,
      yearsWrenching: u?.yearsWrenching ?? null,
    };
  }
}

export const storage = new DatabaseStorage();
