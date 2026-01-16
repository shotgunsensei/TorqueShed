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
  password: text("password").notNull(),
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
  chatMessages: many(chatMessages),
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
  chatMessages: many(chatMessages),
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

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  garageId: varchar("garage_id", { length: 50 }).notNull().references(() => garages.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: varchar("deleted_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
  garage: one(garages, { fields: [chatMessages.garageId], references: [garages.id] }),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  garageId: true,
  userId: true,
  content: true,
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
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type VehicleNote = typeof vehicleNotes.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
