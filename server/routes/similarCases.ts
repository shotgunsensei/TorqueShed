// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getUserTier, tierHasFeature } from "../entitlements";
import { buildSimilarCasesResult, parseVehicle } from "../similar-cases";

const parseListParam = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.flatMap((v) => parseListParam(v));
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

export function register(app: Express): void {
  app.get("/api/cases/similar", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = await getUserTier(req.userId!);
      const hasFull = tierHasFeature(tier, "similar_solved_matching");

      const obdCodes = parseListParam(req.query.obdCodes);
      const symptoms = parseListParam(req.query.symptoms);
      const systemCategory =
        typeof req.query.systemCategory === "string" && req.query.systemCategory.trim()
          ? req.query.systemCategory.trim()
          : null;
      const excludeId =
        typeof req.query.excludeId === "string" && req.query.excludeId.trim()
          ? req.query.excludeId.trim()
          : null;

      let vehicleName: string | null =
        typeof req.query.vehicleName === "string" && req.query.vehicleName.trim()
          ? req.query.vehicleName.trim()
          : null;

      if (!vehicleName && typeof req.query.vehicleId === "string" && req.query.vehicleId.trim()) {
        const vehicle = await storage.getVehicle(req.query.vehicleId.trim());
        if (vehicle && vehicle.userId === req.userId) {
          vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || null;
        }
      }

      // Need at least something to match against
      if (!vehicleName && obdCodes.length === 0 && symptoms.length === 0 && !systemCategory) {
        return res.json({ cases: [], hiddenCount: 0, totalAvailable: 0, hasFeature: hasFull });
      }

      const { make } = parseVehicle(vehicleName);
      const candidates = await storage.getSolvedThreads({
        obdCodes,
        vehicleMake: make || null,
        systemCategory,
      });
      const result = buildSimilarCasesResult(
        { vehicleName, obdCodes, symptoms, systemCategory, excludeId },
        candidates,
        hasFull,
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching similar cases (preview):", error);
      res.status(500).json({ error: "Failed to load similar cases" });
    }
  });

  app.get("/api/cases/:caseId/similar", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const tier = await getUserTier(req.userId!);
      const hasFull = tierHasFeature(tier, "similar_solved_matching");

      const { make } = parseVehicle(thread.vehicleName);
      const candidates = await storage.getSolvedThreads({
        obdCodes: thread.obdCodes ?? [],
        vehicleMake: make || null,
        systemCategory: thread.systemCategory,
      });
      const result = buildSimilarCasesResult(
        {
          vehicleName: thread.vehicleName,
          obdCodes: thread.obdCodes ?? [],
          symptoms: thread.symptoms ?? [],
          systemCategory: thread.systemCategory,
          excludeId: thread.id,
        },
        candidates,
        hasFull,
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching similar cases:", error);
      res.status(500).json({ error: "Failed to load similar cases" });
    }
  });
}
