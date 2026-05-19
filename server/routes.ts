// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express } from "express";
import { createServer, type Server } from "node:http";

import { register as registerAuth } from "./routes/auth";
import { register as registerObjects } from "./routes/objects";
import { register as registerGarages } from "./routes/garages";
import { register as registerReports } from "./routes/reports";
import { register as registerUsers } from "./routes/users";
import { register as registerTorqueAssist } from "./routes/torqueAssist";
import { register as registerDiagnosticSessions } from "./routes/diagnosticSessions";
import { register as registerProducts } from "./routes/products";
import { register as registerFeed } from "./routes/feed";
import { register as registerVehicles } from "./routes/vehicles";
import { register as registerVehicleNotes } from "./routes/vehicleNotes";
import { register as registerThreads } from "./routes/threads";
import { register as registerThreadReplies } from "./routes/threadReplies";
import { register as registerSwapShop } from "./routes/swapShop";
import { register as registerSaved } from "./routes/saved";
import { register as registerSubscriptions } from "./routes/subscriptions";
import { register as registerSellerProfile } from "./routes/sellerProfile";
import { register as registerShopProfile } from "./routes/shopProfile";
import { register as registerShopServices } from "./routes/shopServices";
import { register as registerShopLeads } from "./routes/shopLeads";
import { register as registerShopTeam } from "./routes/shopTeam";
import { register as registerCustomerSummaries } from "./routes/customerSummaries";
import { register as registerSellerDashboard } from "./routes/sellerDashboard";
import { register as registerExpertReviews } from "./routes/expertReviews";
import { register as registerRepairPlan } from "./routes/repairPlan";
import { register as registerCaseRecommendations } from "./routes/caseRecommendations";
import { register as registerCaseTools } from "./routes/caseTools";
import { register as registerSimilarCases } from "./routes/similarCases";
import { register as registerMaintenanceDue } from "./routes/maintenanceDue";
import { register as registerTools } from "./routes/tools";
import { register as registerListings } from "./routes/listings";
import { register as registerPublicShop } from "./routes/publicShop";
import { register as registerOperatorSso } from "./routes/operatorSso";
import { register as registerEntitlements } from "./routes/entitlements";

export async function registerRoutes(app: Express): Promise<Server> {
  // Unauthenticated mutating endpoints are rate-limited by IP via rateLimited().
  // Other mutating routes require auth (requireAuth / requireAdmin) or carry
  // their own in-handler limiter (torque-assist, public shop leads).
  registerAuth(app);
  registerObjects(app);
  registerGarages(app);
  registerReports(app);
  registerUsers(app);
  registerTorqueAssist(app);
  registerDiagnosticSessions(app);
  registerProducts(app);
  registerFeed(app);
  registerVehicles(app);
  registerVehicleNotes(app);
  registerThreads(app);
  registerThreadReplies(app);
  registerSwapShop(app);
  registerSaved(app);
  registerSubscriptions(app);
  registerSellerProfile(app);
  registerShopProfile(app);
  registerShopServices(app);
  registerShopLeads(app);
  registerShopTeam(app);
  registerCustomerSummaries(app);
  registerSellerDashboard(app);
  registerExpertReviews(app);
  registerRepairPlan(app);
  registerCaseRecommendations(app);
  registerCaseTools(app);
  registerSimilarCases(app);
  registerMaintenanceDue(app);
  registerTools(app);
  registerListings(app);
  registerPublicShop(app);
  registerOperatorSso(app);
  registerEntitlements(app);

  // ---- Stripe webhook ----
  // The single Stripe webhook handler lives in `server/index.ts`
  // (`setupStripeWebhook`). It must be registered before `express.json()` so
  // the raw body Buffer is available for signature verification by
  // `stripe-replit-sync`. That handler also covers expert-escalation one-time
  // checkouts via `handleExpertEscalationEvent`. Do not add a second handler
  // here — Express short-circuits on first response and the duplicate would
  // be silently dead code.

  return createServer(app);
}
