import type { Thread } from "@shared/schema";

export type SolvedCandidate = Thread & {
  vehicleName: string | null;
};

export interface SimilarCasesInput {
  vehicleName?: string | null;
  obdCodes?: string[] | null;
  systemCategory?: string | null;
  symptoms?: string[] | null;
  excludeId?: string | null;
}

export interface ScoredCase {
  thread: SolvedCandidate;
  score: number;
  reasons: string[];
}

export interface SimilarCasePayload {
  id: string;
  title: string;
  vehicleName: string | null;
  systemCategory: string | null;
  obdCodes: string[];
  score: number;
  matchReasons: string[];
}

export interface SimilarCasesResult {
  cases: SimilarCasePayload[];
  hiddenCount: number;
  totalAvailable: number;
  hasFeature: boolean;
}

const MAX_RESULTS = 5;
const PREVIEW_RESULTS = 1;

function parseVehicle(name: string | null | undefined): { make: string; model: string } {
  const tokens = (name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const yearIdx = tokens.findIndex((t) => /^(19|20)\d{2}$/.test(t));
  const afterYear = yearIdx >= 0 ? tokens.slice(yearIdx + 1) : tokens;
  const make = afterYear[0] ?? "";
  const model = afterYear[1] ?? "";
  return { make, model };
}

function normalizeDtcs(codes: string[] | null | undefined): string[] {
  return (codes ?? [])
    .map((c) => (c ?? "").toString().toUpperCase().trim())
    .filter(Boolean);
}

function isSolved(t: Thread): boolean {
  return Boolean(t.hasSolution) || t.status === "solved" || Boolean(t.finalFix && t.finalFix.trim());
}

export function scoreSimilarCases(
  input: SimilarCasesInput,
  candidates: SolvedCandidate[],
): ScoredCase[] {
  const baseDtcs = normalizeDtcs(input.obdCodes);
  const baseVehicle = parseVehicle(input.vehicleName);
  const baseSymptomList = input.symptoms ?? [];
  const baseSymptoms = baseSymptomList.join(" ").toLowerCase();

  return candidates
    .filter((t) => t.id !== input.excludeId && isSolved(t))
    .map<ScoredCase>((t) => {
      let score = 0;
      const reasons: string[] = [];

      const tVehicle = parseVehicle(t.vehicleName);
      const sameMake = baseVehicle.make && tVehicle.make && baseVehicle.make === tVehicle.make;
      const sameModel = baseVehicle.model && tVehicle.model && baseVehicle.model === tVehicle.model;
      if (sameMake && sameModel) {
        score += 25;
        reasons.push(`Same make + model (${baseVehicle.make} ${baseVehicle.model})`);
      } else if (sameMake) {
        score += 10;
        reasons.push(`Same make (${baseVehicle.make})`);
      }

      const tDtcs = normalizeDtcs(t.obdCodes);
      const dtcOverlap = baseDtcs.filter((c) => tDtcs.includes(c));
      if (dtcOverlap.length > 0) {
        score += 25 * dtcOverlap.length;
        reasons.push(`DTC match: ${dtcOverlap.join(", ")}`);
      }

      if (input.systemCategory && t.systemCategory === input.systemCategory) {
        score += 5;
        reasons.push("Same system");
      }

      const tSymptoms = (t.symptoms ?? []).join(" ").toLowerCase();
      if (baseSymptoms && tSymptoms) {
        const baseWords = Array.from(
          new Set(baseSymptoms.split(/\W+/).filter((w) => w.length > 4)),
        );
        const overlap = baseWords.filter((w) => tSymptoms.includes(w));
        if (overlap.length > 0) {
          score += overlap.length * 2;
          reasons.push(`Symptom overlap (${overlap.length})`);
        }
      }

      return { thread: t, score, reasons };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function buildSimilarCasesResult(
  input: SimilarCasesInput,
  candidates: SolvedCandidate[],
  hasFeature: boolean,
): SimilarCasesResult {
  const scored = scoreSimilarCases(input, candidates);
  const top = scored.slice(0, MAX_RESULTS);
  const visible = hasFeature ? top : top.slice(0, PREVIEW_RESULTS);
  return {
    cases: visible.map((s) => ({
      id: s.thread.id,
      title: s.thread.title,
      vehicleName: s.thread.vehicleName,
      systemCategory: s.thread.systemCategory,
      obdCodes: s.thread.obdCodes ?? [],
      score: s.score,
      matchReasons: s.reasons,
    })),
    hiddenCount: top.length - visible.length,
    totalAvailable: top.length,
    hasFeature,
  };
}
