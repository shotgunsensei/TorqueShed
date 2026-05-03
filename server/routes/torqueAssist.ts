// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { torqueAssistRequestSchema } from "@shared/torque-assist";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getUserTier, tierHasFeature } from "../entitlements";
import { checkRateLimitAsync, getCachedResponse, cacheResponse, generateTorqueAssistResponse } from "../torque-assist";

export function register(app: Express): void {
  app.post("/api/torque-assist", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clientId = req.ip || "unknown";
      
      const allowed = await checkRateLimitAsync(clientId);
      if (!allowed) {
        return res.status(429).json({ 
          error: { 
            code: "RATE_LIMITED", 
            message: "Too many requests. Please wait a moment before trying again." 
          } 
        });
      }
      
      const parsed = torqueAssistRequestSchema.parse(req.body);

      const tier = await getUserTier(req.userId ?? null);
      const isPaid = tierHasFeature(tier, "advanced_diagnostic_tree");

      const cached = getCachedResponse(parsed);
      const fullResponse = cached ?? generateTorqueAssistResponse(parsed);
      if (!cached) cacheResponse(parsed, fullResponse);

      if (isPaid) {
        return res.json({ ...fullResponse, tier, gated: false });
      }

      const trimmed = {
        ...fullResponse,
        likelyCauses: fullResponse.likelyCauses.slice(0, 1),
        recommendedChecks: fullResponse.recommendedChecks.slice(0, 2).map((c) => ({ ...c, tools: c.tools.slice(0, 2) })),
        torqueSpecs: null,
        suggestedParts: [],
        purchaseLinks: [],
        purchaseOptions: [],
        tier,
        gated: true,
        upgradeHint: {
          feature: "advanced_diagnostic_tree" as const,
          requiredTier: "diy_pro",
          message: "Upgrade to DIY Pro for the full diagnostic walkthrough, parts list, and torque specs.",
        },
      };
      res.json(trimmed);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: { 
            code: "INVALID_REQUEST", 
            message: error.errors.map(e => e.message).join(", ") 
          } 
        });
      }
      console.error("Error in TorqueAssist:", error);
      res.status(500).json({ 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "An error occurred processing your request" 
        } 
      });
    }
  });
}
