import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, primaryKey, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const FOCUS_AREAS = [
  "Engine",
  "Electrical", 
  "Suspension",
  "Diesel",
  "Tuning",
  "Fabrication",
  "Diagnostics",
  "HVAC",
  "Brakes",
  "Drivetrain",
] as const;

export type FocusArea = typeof FOCUS_AREAS[number];

export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: varchar("location", { length: 100 }),
  role: varchar("role", { length: 20 }).default("user"),
  focusAreas: json("focus_areas").$type<FocusArea[]>().default([]),
  vehiclesWorkedOn: text("vehicles_worked_on"),
  yearsWrenching: integer("years_wrenching"),
  shopAffiliation: varchar("shop_affiliation", { length: 200 }),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingGoals: json("onboarding_goals").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),
  reports: many(reports),
}));

export const garages = pgTable("garages", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  brandColor: varchar("brand_color", { length: 7 }),
  memberCount: integer("member_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const garagesRelations = relations(garages, ({ many }) => ({
  members: many(garageMembers),
}));

export const garageMembers = pgTable("garage_members", {
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  garageId: varchar("garage_id", { length: 50 }).notNull().references(() => garages.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.garageId] }),
]);

export const garageMembersRelations = relations(garageMembers, ({ one }) => ({
  user: one(users, { fields: [garageMembers.userId], references: [users.id] }),
  garage: one(garages, { fields: [garageMembers.garageId], references: [garages.id] }),
}));

export const vehicles = pgTable("vehicles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  vin: varchar("vin", { length: 17 }),
  year: integer("year"),
  make: varchar("make", { length: 50 }),
  model: varchar("model", { length: 100 }),
  nickname: varchar("nickname", { length: 100 }),
  imageUrl: text("image_url"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  user: one(users, { fields: [vehicles.userId], references: [users.id] }),
  notes: many(vehicleNotes),
}));

export const NOTE_TYPES = ["maintenance", "mod", "issue", "general"] as const;

export const vehicleNotes = pgTable("vehicle_notes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id", { length: 36 }).notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 20 }).default("general"),
  cost: varchar("cost", { length: 20 }),
  mileage: integer("mileage"),
  partsUsed: json("parts_used").$type<string[]>(),
  isPrivate: boolean("is_private").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vehicleNotesRelations = relations(vehicleNotes, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehicleNotes.vehicleId], references: [vehicles.id] }),
  user: one(users, { fields: [vehicleNotes.userId], references: [users.id] }),
}));

export const reports = pgTable("reports", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  reportedUserId: varchar("reported_user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
  contentType: varchar("content_type", { length: 20 }).notNull(),
  contentId: varchar("content_id", { length: 36 }),
  reason: varchar("reason", { length: 50 }).notNull(),
  details: text("details"),
  status: varchar("status", { length: 20 }).default("pending"),
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
}));

export const PRODUCT_CATEGORIES = [
  "Performance",
  "Suspension",
  "Exhaust",
  "Lighting",
  "Interior",
  "Exterior",
  "Tools",
  "Safety",
  "Electronics",
  "Maintenance",
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const SUBMISSION_STATUSES = ["pending", "approved", "featured"] as const;
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number];

export const products = pgTable("products", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  whyItMatters: text("why_it_matters"),
  price: varchar("price", { length: 50 }),
  priceRange: varchar("price_range", { length: 50 }),
  category: varchar("category", { length: 50 }).notNull(),
  affiliateLink: text("affiliate_link"),
  vendor: varchar("vendor", { length: 100 }),
  imageUrl: text("image_url"),
  isSponsored: boolean("is_sponsored").default(false),
  submissionStatus: varchar("submission_status", { length: 20 }).default("pending"),
  featuredExpiration: timestamp("featured_expiration"),
  views: integer("views").default(0),
  clicks: integer("clicks").default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productsRelations = relations(products, ({ one }) => ({
  creator: one(users, { fields: [products.createdBy], references: [users.id] }),
}));

export const productsInsertSchema = createInsertSchema(products);

export const insertProductSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().nullable().optional(),
  whyItMatters: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  priceRange: z.string().nullable().optional(),
  category: z.enum(PRODUCT_CATEGORIES, { errorMap: () => ({ message: "Valid category is required" }) }),
  affiliateLink: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isSponsored: z.boolean().optional().default(false),
});

export const threads = pgTable("threads", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id", { length: 50 }).notNull().references(() => garages.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  hasSolution: boolean("has_solution").default(false),
  isPinned: boolean("is_pinned").default(false),
  replyCount: integer("reply_count").default(0),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  garage: one(garages, { fields: [threads.garageId], references: [garages.id] }),
  replies: many(threadReplies),
}));

export const threadReplies = pgTable("thread_replies", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isSolution: boolean("is_solution").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const threadRepliesRelations = relations(threadReplies, ({ one }) => ({
  thread: one(threads, { fields: [threadReplies.threadId], references: [threads.id] }),
  user: one(users, { fields: [threadReplies.userId], references: [users.id] }),
}));

export const ITEM_CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"] as const;
export type ItemCondition = typeof ITEM_CONDITIONS[number];

export const swapShopListings = pgTable("swap_shop_listings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  price: varchar("price", { length: 50 }).notNull(),
  condition: varchar("condition", { length: 20 }).notNull(),
  location: varchar("location", { length: 100 }),
  localPickup: boolean("local_pickup").default(true),
  willShip: boolean("will_ship").default(false),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const swapShopListingsRelations = relations(swapShopListings, ({ one }) => ({
  user: one(users, { fields: [swapShopListings.userId], references: [users.id] }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
});

export const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const VALID_CONTENT_TYPES = ["forum_thread", "forum_reply", "user"] as const;
export const VALID_REPORT_REASONS = ["spam", "harassment", "scam", "illegal", "impersonation", "other"] as const;

export const createReportSchema = z.object({
  reportedUserId: z.string().nullable().optional(),
  contentType: z.enum(VALID_CONTENT_TYPES),
  contentId: z.string().nullable().optional(),
  reason: z.enum(VALID_REPORT_REASONS),
  details: z.string().nullable().optional(),
});

export const updateProfileSchema = z.object({
  bio: z.string().max(500, "Bio must be under 500 characters").optional(),
  location: z.string().max(100, "Location must be under 100 characters").optional(),
  avatarUrl: z.string().optional(),
  focusAreas: z.array(z.enum(FOCUS_AREAS)).optional(),
  vehiclesWorkedOn: z.string().max(1000, "Vehicles worked on must be under 1000 characters").nullable().optional(),
  yearsWrenching: z.preprocess((val) => (typeof val === "string" ? parseInt(val, 10) : val), z.number().min(0).max(100, "Years wrenching must be between 0 and 100").nullable().optional()),
  shopAffiliation: z.string().max(200, "Shop affiliation must be under 200 characters").nullable().optional(),
});

export const insertThreadSchema = z.object({
  garageId: z.string().min(1, "Garage ID is required"),
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
});

export const insertThreadReplySchema = z.object({
  threadId: z.string().min(1, "Thread ID is required"),
  content: z.string().min(1, "Content is required"),
});

export const insertSwapShopListingSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().nullable().optional(),
  price: z.string().min(1, "Price is required").max(50),
  condition: z.enum(ITEM_CONDITIONS, { errorMap: () => ({ message: "Valid condition is required" }) }),
  location: z.string().max(100).nullable().optional(),
  localPickup: z.boolean().optional().default(true),
  willShip: z.boolean().optional().default(false),
  imageUrl: z.string().nullable().optional(),
});

export const insertVehicleSchema = z.object({
  vin: z.string().max(17).nullable().optional(),
  year: z.preprocess((val) => (typeof val === "string" ? parseInt(val, 10) : val), z.number().nullable().optional()),
  make: z.string().max(50).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isPublic: z.boolean().optional().default(false),
});

export const insertVehicleNoteSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["maintenance", "mod", "issue", "general"]).optional().default("general"),
  cost: z.string().max(20).optional().nullable(),
  mileage: z.number().int().positive().optional().nullable(),
  partsUsed: z.array(z.string()).optional().nullable(),
  isPrivate: z.boolean().optional().default(false),
});

export const insertReportSchema = createInsertSchema(reports).pick({
  reporterId: true,
  reportedUserId: true,
  contentType: true,
  contentId: true,
  reason: true,
  details: true,
});

export const updateVehicleSchema = z.object({
  vin: z.string().max(17).nullable().optional(),
  year: z.preprocess((val) => (typeof val === "string" ? parseInt(val, 10) : val), z.number().nullable().optional()),
  make: z.string().max(50).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const updateVehicleNoteSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(255).optional(),
  content: z.string().min(1, "Content cannot be empty").optional(),
  type: z.enum(["maintenance", "mod", "issue", "general"]).optional(),
  cost: z.string().max(20).optional().nullable(),
  mileage: z.number().int().positive().optional().nullable(),
  partsUsed: z.array(z.string()).optional().nullable(),
  isPrivate: z.boolean().optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(255).optional(),
  content: z.string().min(1, "Content cannot be empty").optional(),
  hasSolution: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export const updateSwapShopListingSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(255).optional(),
  description: z.string().nullable().optional(),
  price: z.string().min(1, "Price cannot be empty").max(50).optional(),
  condition: z.enum(ITEM_CONDITIONS, { errorMap: () => ({ message: "Valid condition is required" }) }).optional(),
  location: z.string().max(100).nullable().optional(),
  localPickup: z.boolean().optional(),
  willShip: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  whyItMatters: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  priceRange: z.string().nullable().optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  affiliateLink: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isSponsored: z.boolean().optional(),
  submissionStatus: z.enum(SUBMISSION_STATUSES).optional(),
  featuredExpiration: z.string().nullable().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Garage = typeof garages.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type VehicleNote = typeof vehicleNotes.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Thread = typeof threads.$inferSelect;
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type ThreadReply = typeof threadReplies.$inferSelect;
export type InsertThreadReply = z.infer<typeof insertThreadReplySchema>;
export type SwapShopListing = typeof swapShopListings.$inferSelect;
export type InsertSwapShopListing = z.infer<typeof insertSwapShopListingSchema>;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type InsertVehicleNote = z.infer<typeof insertVehicleNoteSchema>;
