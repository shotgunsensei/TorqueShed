import { z } from "zod";

export const vehicleIdentifierSchema = z.object({
  type: z.enum(["vin", "ymm"]),
  vin: z.string().length(17).optional(),
  year: z.number().min(1900).max(2030).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
}).refine(
  (data) => {
    if (data.type === "vin") return !!data.vin;
    return !!data.year && !!data.make && !!data.model;
  },
  { message: "VIN required for VIN type, or Year/Make/Model for YMM type" }
);

export const torqueAssistRequestSchema = z.object({
  vehicle: vehicleIdentifierSchema,
  issue: z.string().min(3).max(500),
});

export const decodedVehicleSchema = z.object({
  year: z.number(),
  make: z.string(),
  model: z.string(),
  trim: z.string().nullable(),
  engine: z.string().nullable(),
  transmission: z.string().nullable(),
  drivetrain: z.string().nullable(),
});

export const torqueSpecSchema = z.object({
  component: z.string(),
  spec: z.string(),
  notes: z.string().nullable(),
});

export const suggestedPartSchema = z.object({
  name: z.string(),
  category: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  estimatedCost: z.string().nullable(),
});

export const purchaseLinkSchema = z.object({
  provider: z.string(),
  url: z.string(),
  type: z.enum(["oem", "aftermarket", "used"]),
});

export const purchaseOptionSchema = z.object({
  vendorName: z.string(),
  priceRange: z.string().nullable(),
  affiliateUrl: z.string().nullable(),
  disclosureFlag: z.boolean(),
  partName: z.string(),
  type: z.enum(["oem", "aftermarket", "used"]),
});

export const torqueAssistResponseSchema = z.object({
  vehicle: decodedVehicleSchema,
  normalizedIssue: z.string(),
  likelyCauses: z.array(z.object({
    cause: z.string(),
    probability: z.enum(["high", "medium", "low"]),
    explanation: z.string(),
  })),
  recommendedChecks: z.array(z.object({
    step: z.number(),
    action: z.string(),
    tools: z.array(z.string()),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  })),
  torqueSpecs: z.array(torqueSpecSchema).nullable(),
  suggestedParts: z.array(suggestedPartSchema),
  purchaseLinks: z.array(purchaseLinkSchema),
  purchaseOptions: z.array(purchaseOptionSchema),
  confidenceNote: z.enum([
    "common_issue",
    "vehicle_specific",
    "general_guidance",
    "requires_diagnosis",
  ]),
  disclaimer: z.string(),
});

export type VehicleIdentifier = z.infer<typeof vehicleIdentifierSchema>;
export type TorqueAssistRequest = z.infer<typeof torqueAssistRequestSchema>;
export type DecodedVehicle = z.infer<typeof decodedVehicleSchema>;
export type TorqueSpec = z.infer<typeof torqueSpecSchema>;
export type SuggestedPart = z.infer<typeof suggestedPartSchema>;
export type PurchaseLink = z.infer<typeof purchaseLinkSchema>;
export type PurchaseOption = z.infer<typeof purchaseOptionSchema>;
export type TorqueAssistResponse = z.infer<typeof torqueAssistResponseSchema>;

export interface TorqueAssistError {
  code: string;
  message: string;
  details?: string;
}
