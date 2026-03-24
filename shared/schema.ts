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
  passwordHash: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: varchar("location", { length: 100 }),
  role: varchar("role", { length: 20 }).default("user"),
  focusAreas: json("focus_areas").$type<FocusArea[]>().default([]),
  vehiclesWorkedOn: text("vehicles_worked_on"),
  yearsWrenching: integer("years_wrenching"),
  shopAffiliation: varchar("shop_affiliation", { length: 200 }),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  user: one(users, { fields: [vehicles.userId], references: [users.id] }),
  notes: many(vehicleNotes),
}));

export const vehicleNotes = pgTable("vehicle_notes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id", { length: 36 }).notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
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

export const insertProductSchema = createInsertSchema(products).pick({
  title: true,
  description: true,
  whyItMatters: true,
  price: true,
  priceRange: true,
  category: true,
  affiliateLink: true,
  vendor: true,
  imageUrl: true,
  isSponsored: true,
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

export const insertThreadSchema = createInsertSchema(threads).pick({
  garageId: true,
  title: true,
  content: true,
});

export const insertThreadReplySchema = createInsertSchema(threadReplies).pick({
  threadId: true,
  content: true,
});

export const insertSwapShopListingSchema = createInsertSchema(swapShopListings).pick({
  title: true,
  description: true,
  price: true,
  condition: true,
  location: true,
  localPickup: true,
  willShip: true,
  imageUrl: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).pick({
  vin: true,
  year: true,
  make: true,
  model: true,
  nickname: true,
  imageUrl: true,
});

export const insertVehicleNoteSchema = createInsertSchema(vehicleNotes).pick({
  vehicleId: true,
  title: true,
  content: true,
  isPrivate: true,
});

export const insertReportSchema = createInsertSchema(reports).pick({
  reporterId: true,
  reportedUserId: true,
  contentType: true,
  contentId: true,
  reason: true,
  details: true,
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
