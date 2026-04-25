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
  trim: varchar("trim", { length: 100 }),
  engine: varchar("engine", { length: 100 }),
  drivetrain: varchar("drivetrain", { length: 50 }),
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
  beforeState: text("before_state"),
  afterState: text("after_state"),
  nextDueMileage: integer("next_due_mileage"),
  nextDueDate: timestamp("next_due_date"),
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

export const CASE_STATUSES = ["open", "testing", "needs_expert", "solved"] as const;
export type CaseStatus = typeof CASE_STATUSES[number];

export const SYSTEM_CATEGORIES = [
  "engine",
  "electrical",
  "transmission",
  "brakes",
  "suspension",
  "cooling",
  "fuel",
  "exhaust",
  "hvac",
  "interior",
  "body",
  "tires",
  "other",
] as const;
export type SystemCategory = typeof SYSTEM_CATEGORIES[number];

export const URGENCY_LEVELS = ["low", "normal", "high", "stranded"] as const;
export type UrgencyLevel = typeof URGENCY_LEVELS[number];

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
  vehicleId: varchar("vehicle_id", { length: 36 }).references(() => vehicles.id, { onDelete: "set null" }),
  symptoms: json("symptoms").$type<string[]>(),
  obdCodes: json("obd_codes").$type<string[]>(),
  severity: integer("severity"),
  drivability: integer("drivability"),
  recentChanges: text("recent_changes"),
  status: varchar("status", { length: 20 }).default("open"),
  systemCategory: varchar("system_category", { length: 20 }),
  urgency: varchar("urgency", { length: 20 }),
  budget: varchar("budget", { length: 50 }),
  toolsAvailable: text("tools_available"),
  whenItHappens: text("when_it_happens"),
  partsReplaced: text("parts_replaced"),
  rootCause: text("root_cause"),
  finalFix: text("final_fix"),
  partsUsed: json("parts_used").$type<string[]>(),
  toolsUsed: json("tools_used").$type<string[]>(),
  solvedCost: varchar("solved_cost", { length: 50 }),
  laborMinutes: integer("labor_minutes"),
  verificationNotes: text("verification_notes"),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  garage: one(garages, { fields: [threads.garageId], references: [garages.id] }),
  replies: many(threadReplies),
}));

export const REPLY_TYPES = [
  "comment",
  "question",
  "suggested_test",
  "test_result",
  "confirmed_fix",
  "warning",
  "part_recommendation",
  "tool_recommendation",
  "shop_estimate",
] as const;
export type ReplyType = typeof REPLY_TYPES[number];

export const threadReplies = pgTable("thread_replies", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  replyType: varchar("reply_type", { length: 30 }).default("comment"),
  isSolution: boolean("is_solution").default(false),
  solutionDifficulty: integer("solution_difficulty"),
  solutionCost: varchar("solution_cost", { length: 50 }),
  solutionTools: json("solution_tools").$type<string[]>(),
  solutionParts: json("solution_parts").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const threadRepliesRelations = relations(threadReplies, ({ one }) => ({
  thread: one(threads, { fields: [threadReplies.threadId], references: [threads.id] }),
  user: one(users, { fields: [threadReplies.userId], references: [users.id] }),
}));

export const ITEM_CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"] as const;
export type ItemCondition = typeof ITEM_CONDITIONS[number];

export const LISTING_CATEGORIES = ["parts", "tools", "scan_tools", "services", "project_vehicles"] as const;
export type ListingCategory = typeof LISTING_CATEGORIES[number];

export const swapShopListings = pgTable("swap_shop_listings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  price: varchar("price", { length: 50 }).notNull(),
  condition: varchar("condition", { length: 20 }).notNull(),
  category: varchar("category", { length: 30 }).default("parts"),
  vehicleCompatibility: text("vehicle_compatibility"),
  location: varchar("location", { length: 100 }),
  localPickup: boolean("local_pickup").default(true),
  willShip: boolean("will_ship").default(false),
  imageUrl: text("image_url"),
  extraImageUrls: json("extra_image_urls").$type<string[]>().default([]),
  contactMethod: varchar("contact_method", { length: 30 }),
  attachedCaseId: varchar("attached_case_id", { length: 36 }),
  isRecommendedForCase: boolean("is_recommended_for_case").default(false),
  isActive: boolean("is_active").default(true),
  isDraft: boolean("is_draft").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const swapShopListingsRelations = relations(swapShopListings, ({ one }) => ({
  user: one(users, { fields: [swapShopListings.userId], references: [users.id] }),
}));

export const savedThreads = pgTable("saved_threads", {
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  savedAt: timestamp("saved_at").defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.threadId] }),
]);

export const diagnosticSessions = pgTable("diagnostic_sessions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleYear: integer("vehicle_year"),
  vehicleMake: varchar("vehicle_make", { length: 50 }),
  vehicleModel: varchar("vehicle_model", { length: 100 }),
  vehicleEngine: varchar("vehicle_engine", { length: 100 }),
  vehicleMileage: integer("vehicle_mileage"),
  vehicleVin: varchar("vehicle_vin", { length: 17 }),
  categoryId: varchar("category_id", { length: 50 }),
  phase: varchar("phase", { length: 20 }).default("intake"),
  answers: json("answers").$type<Record<string, string>>().default({}),
  completedTests: json("completed_tests").$type<Record<string, { result: string; notes: string; completedAt: string }>>().default({}),
  dtcCodes: json("dtc_codes").$type<string[]>().default([]),
  recentRepairs: text("recent_repairs"),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const diagnosticSessionsRelations = relations(diagnosticSessions, ({ one }) => ({
  user: one(users, { fields: [diagnosticSessions.userId], references: [users.id] }),
}));

export const savedListings = pgTable("saved_listings", {
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  listingId: varchar("listing_id", { length: 36 }).notNull().references(() => swapShopListings.id, { onDelete: "cascade" }),
  savedAt: timestamp("saved_at").defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.listingId] }),
]);

export const SUBSCRIPTION_TIERS = ["free", "diy_pro", "garage_pro", "shop_pro"] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

export const SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due", "trialing", "incomplete"] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 20 }).notNull().default("free"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const SELLER_TYPES = ["individual", "garage", "shop"] as const;
export type SellerType = typeof SELLER_TYPES[number];

export const sellerProfiles = pgTable("seller_profiles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  sellerType: varchar("seller_type", { length: 20 }).notNull().default("individual"),
  bio: text("bio"),
  location: varchar("location", { length: 100 }),
  ratingAverage: integer("rating_average").default(0),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const EXPERT_SERVICE_LEVELS = ["quick_review", "full_diagnostic", "live_remote"] as const;
export type ExpertServiceLevel = typeof EXPERT_SERVICE_LEVELS[number];

export const EXPERT_REVIEW_STATUSES = ["requested", "in_review", "responded", "closed", "canceled"] as const;
export type ExpertReviewStatus = typeof EXPERT_REVIEW_STATUSES[number];

export const PAYMENT_STATUSES = ["pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const expertReviews = pgTable("expert_reviews", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceLevel: varchar("service_level", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("requested"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"),
  assignedExpertId: varchar("assigned_expert_id", { length: 36 }),
  userNotes: text("user_notes"),
  expertNotes: text("expert_notes"),
  priceCents: integer("price_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const REPAIR_PLAN_EXPORT_TYPES = ["preview", "pdf"] as const;
export type RepairPlanExportType = typeof REPAIR_PLAN_EXPORT_TYPES[number];

export const repairPlanExports = pgTable("repair_plan_exports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  exportType: varchar("export_type", { length: 20 }).notNull().default("preview"),
  status: varchar("status", { length: 20 }).notNull().default("ready"),
  payload: json("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const TOOL_CATEGORIES = [
  "hand_tool",
  "power_tool",
  "diagnostic",
  "lifting",
  "specialty",
  "consumable",
  "safety",
  "other",
] as const;
export type ToolCategory = typeof TOOL_CATEGORIES[number];

export const tools = pgTable("tools", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  brand: varchar("brand", { length: 100 }),
  category: varchar("category", { length: 30 }).notNull().default("hand_tool"),
  notes: text("notes"),
  purchasePrice: varchar("purchase_price", { length: 50 }),
  purchasedAt: timestamp("purchased_at"),
  storageLocation: varchar("storage_location", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const toolsRelations = relations(tools, ({ one, many }) => ({
  user: one(users, { fields: [tools.userId], references: [users.id] }),
  caseUses: many(caseToolsUsed),
}));

export const caseToolsUsed = pgTable("case_tools_used", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  toolId: varchar("tool_id", { length: 36 }).notNull().references(() => tools.id, { onDelete: "cascade" }),
  attachedBy: varchar("attached_by", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const caseToolsUsedRelations = relations(caseToolsUsed, ({ one }) => ({
  thread: one(threads, { fields: [caseToolsUsed.caseId], references: [threads.id] }),
  tool: one(tools, { fields: [caseToolsUsed.toolId], references: [tools.id] }),
}));

export const RECOMMENDATION_TYPES = ["part", "tool", "service", "affiliate", "marketplace"] as const;
export type RecommendationType = typeof RECOMMENDATION_TYPES[number];

export const caseRecommendations = pgTable("case_recommendations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id", { length: 36 }).notNull().references(() => threads.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  estimatedPrice: varchar("estimated_price", { length: 50 }),
  source: varchar("source", { length: 100 }),
  url: text("url"),
  fitmentNote: text("fitment_note"),
  isRequired: boolean("is_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = z.object({
  tier: z.enum(SUBSCRIPTION_TIERS),
});

export const insertSellerProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  sellerType: z.enum(SELLER_TYPES).default("individual"),
  bio: z.string().max(2000).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
});

export const escalateCaseSchema = z.object({
  serviceLevel: z.enum(EXPERT_SERVICE_LEVELS),
  userNotes: z.string().max(2000).nullable().optional(),
});

export const insertCaseRecommendationSchema = z.object({
  type: z.enum(RECOMMENDATION_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  estimatedPrice: z.string().max(50).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  url: z.string().nullable().optional(),
  fitmentNote: z.string().nullable().optional(),
  isRequired: z.boolean().default(false),
});

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

export const VALID_CONTENT_TYPES = ["forum_thread", "forum_reply", "swap_listing", "user"] as const;
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
  vehicleId: z.string().nullable().optional(),
  symptoms: z.array(z.string()).nullable().optional(),
  obdCodes: z.array(z.string()).nullable().optional(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
  drivability: z.number().int().min(1).max(5).nullable().optional(),
  recentChanges: z.string().nullable().optional(),
  systemCategory: z.enum(SYSTEM_CATEGORIES).nullable().optional(),
  urgency: z.enum(URGENCY_LEVELS).nullable().optional(),
  budget: z.string().max(50).nullable().optional(),
  toolsAvailable: z.string().nullable().optional(),
  whenItHappens: z.string().nullable().optional(),
  partsReplaced: z.string().nullable().optional(),
});

export const insertThreadReplySchema = z.object({
  threadId: z.string().min(1, "Thread ID is required"),
  content: z.string().min(1, "Content is required"),
  replyType: z.enum(REPLY_TYPES).optional(),
});

export const updateThreadStatusSchema = z.object({
  status: z.enum(CASE_STATUSES),
});

export const markSolvedSchema = z.object({
  rootCause: z.string().min(1, "Root cause is required").max(500),
  finalFix: z.string().min(1, "Final fix description is required"),
  partsUsed: z.array(z.string()).nullable().optional(),
  toolsUsed: z.array(z.string()).nullable().optional(),
  solvedCost: z.string().max(50).nullable().optional(),
  laborMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  verificationNotes: z.string().nullable().optional(),
  replyId: z.string().nullable().optional(),
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
  extraImageUrls: z.array(z.string()).max(8).optional().default([]),
  contactMethod: z.enum(["in_app", "email", "phone", "external"]).nullable().optional(),
  isDraft: z.boolean().optional().default(false),
  category: z.enum(LISTING_CATEGORIES).optional().default("parts"),
  attachedCaseId: z.string().nullable().optional(),
});

export const insertVehicleSchema = z.object({
  vin: z.string().max(17).nullable().optional(),
  year: z.preprocess((val) => (typeof val === "string" ? parseInt(val, 10) : val), z.number().nullable().optional()),
  make: z.string().max(50).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
  trim: z.string().max(100).nullable().optional(),
  engine: z.string().max(100).nullable().optional(),
  drivetrain: z.string().max(50).nullable().optional(),
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
  beforeState: z.string().optional().nullable(),
  afterState: z.string().optional().nullable(),
  nextDueMileage: z.number().int().positive().optional().nullable(),
  nextDueDate: z.preprocess(
    (v) => (typeof v === "string" && v ? new Date(v) : v),
    z.date().optional().nullable(),
  ),
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
  trim: z.string().max(100).nullable().optional(),
  engine: z.string().max(100).nullable().optional(),
  drivetrain: z.string().max(50).nullable().optional(),
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
  beforeState: z.string().optional().nullable(),
  afterState: z.string().optional().nullable(),
  nextDueMileage: z.number().int().positive().optional().nullable(),
  nextDueDate: z.preprocess(
    (v) => (typeof v === "string" && v ? new Date(v) : v),
    z.date().optional().nullable(),
  ),
  isPrivate: z.boolean().optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(255).optional(),
  content: z.string().min(1, "Content cannot be empty").optional(),
  hasSolution: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  status: z.enum(CASE_STATUSES).optional(),
  systemCategory: z.enum(SYSTEM_CATEGORIES).nullable().optional(),
  urgency: z.enum(URGENCY_LEVELS).nullable().optional(),
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
  extraImageUrls: z.array(z.string()).max(8).optional(),
  contactMethod: z.enum(["in_app", "email", "phone", "external"]).nullable().optional(),
  isDraft: z.boolean().optional(),
  isActive: z.boolean().optional(),
  category: z.enum(LISTING_CATEGORIES).optional(),
  attachedCaseId: z.string().nullable().optional(),
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
export type DiagnosticSession = typeof diagnosticSessions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type ExpertReview = typeof expertReviews.$inferSelect;
export type RepairPlanExport = typeof repairPlanExports.$inferSelect;
export type CaseRecommendation = typeof caseRecommendations.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type CaseToolUsed = typeof caseToolsUsed.$inferSelect;

export const insertToolSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  brand: z.string().max(100).nullable().optional(),
  category: z.enum(TOOL_CATEGORIES).optional().default("hand_tool"),
  notes: z.string().max(2000).nullable().optional(),
  purchasePrice: z.string().max(50).nullable().optional(),
  purchasedAt: z.preprocess(
    (v) => (typeof v === "string" && v ? new Date(v) : v),
    z.date().optional().nullable(),
  ),
  storageLocation: z.string().max(200).nullable().optional(),
});

export const updateToolSchema = insertToolSchema.partial();
export type InsertTool = z.infer<typeof insertToolSchema>;
