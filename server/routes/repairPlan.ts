// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getContextRecommendations, summarizeCostRange } from "../case-recommendations";
import { getUserTier, tierHasFeature, minimumTierFor, tierLabel } from "../entitlements";

export function register(app: Express): void {
  app.post("/api/cases/:caseId/repair-plan", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const tier = await getUserTier(req.userId!);
      const wantsPdf = req.body?.exportType === "pdf";
      if (wantsPdf && !tierHasFeature(tier, "pdf_repair_plan")) {
        const required = minimumTierFor("pdf_repair_plan");
        return res.status(402).json({
          error: `PDF export requires ${tierLabel(required)} or higher.`,
          upgradeRequired: true,
          feature: "pdf_repair_plan",
          currentTier: tier,
          requiredTier: required,
          requiredTierLabel: tierLabel(required),
        });
      }

      const recs = getContextRecommendations({
        obdCodes: thread.obdCodes,
        systemCategory: thread.systemCategory,
        symptoms: thread.symptoms,
        title: thread.title,
      });
      const totalCostRange = summarizeCostRange(recs);

      const planRec = (r: typeof recs[number]) => ({ title: r.title, reason: r.description });

      const plan = {
        version: 1,
        generatedAt: new Date().toISOString(),
        vehicle: {
          name: thread.vehicleName ?? null,
          mileage: null,
        },
        case: {
          id: thread.id,
          title: thread.title,
          systemCategory: thread.systemCategory,
          urgency: thread.urgency,
          status: thread.status,
        },
        symptoms: thread.symptoms ?? [],
        obdCodes: thread.obdCodes ?? [],
        probableCauses: recs.filter((r) => r.category === "likely_part").slice(0, 5).map((r) => r.title),
        diagnosticSteps: [
          "Verify the symptom is reproducible.",
          "Pull and document any current and pending DTCs.",
          "Inspect related connectors, wiring, and hoses for obvious damage.",
          "Run the targeted tests for each top hypothesis before swapping parts.",
        ],
        toolsNeeded: recs.filter((r) => r.type === "tool").map(planRec),
        partsList: recs.filter((r) => r.type === "part" || r.type === "consumable").map(planRec),
        safetyWarnings: [
          "Always use jack stands when working under a vehicle.",
          "Disconnect the battery before any work on airbag, fuel, or high-voltage systems.",
          "Verify fitment of every part by VIN before installing.",
        ],
        difficulty: thread.urgency === "stranded" ? "advanced" : "moderate",
        estimatedCostRange: totalCostRange.label,
        finalNotes: "Document each test result on the case so the community can verify your final fix.",
        tier,
        exportType: wantsPdf ? "pdf" : "preview",
      };

      const exportType = wantsPdf ? "pdf" : "preview";
      await storage.createRepairPlanExport(req.params.caseId, req.userId!, exportType, plan);

      if (!wantsPdf) {
        return res.json(plan);
      }

      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const safeTitle = (thread.title || "case").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="repair-plan-${safeTitle}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).text("TorqueShed Repair Plan", { align: "left" });
      doc.moveDown(0.3).fontSize(14).text(thread.title);
      if (thread.vehicleName) doc.fontSize(10).fillColor("#666").text(`Vehicle: ${thread.vehicleName}`);
      doc.fontSize(9).fillColor("#888").text(`Generated: ${new Date(plan.generatedAt).toLocaleString()}`);
      doc.fontSize(9).text(`Difficulty: ${plan.difficulty}    Estimated total: ${plan.estimatedCostRange}`);
      doc.moveDown();

      const writeSection = (label: string, items: string[]) => {
        if (items.length === 0) return;
        doc.fillColor("#000").fontSize(13).text(label, { underline: true });
        doc.moveDown(0.2);
        items.forEach((line) => {
          doc.fontSize(10).fillColor("#222").text(`• ${line}`, { indent: 12, paragraphGap: 2 });
        });
        doc.moveDown(0.4);
      };

      if (plan.symptoms.length > 0) writeSection("Symptoms", plan.symptoms);
      if (plan.obdCodes.length > 0) writeSection("DTC Codes", plan.obdCodes);
      if (plan.probableCauses.length > 0) writeSection("Probable Causes", plan.probableCauses);
      writeSection("Diagnostic Steps", plan.diagnosticSteps);
      writeSection("Tools Needed", plan.toolsNeeded.map((t) => `${t.title} — ${t.reason}`));
      writeSection("Parts & Consumables", plan.partsList.map((p) => `${p.title} — ${p.reason}`));
      writeSection("Safety Warnings", plan.safetyWarnings);

      doc.moveDown(0.5).fontSize(8).fillColor("#666").text(plan.finalNotes, { align: "left" });
      doc.fontSize(7).fillColor("#999").text(`TorqueShed · Generated ${new Date(plan.generatedAt).toLocaleDateString()} · Tier: ${tier}`, { align: "right" });
      doc.end();
    } catch (error) {
      console.error("Error generating repair plan:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate repair plan" });
    }
  });
}
