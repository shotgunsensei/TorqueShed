import type { CaseRecommendation } from "@shared/schema";

export type RecCategory =
  | "required_tool"
  | "optional_tool"
  | "likely_part"
  | "consumable"
  | "safety_equipment";

export interface SeedRec
  extends Pick<
    CaseRecommendation,
    "type" | "title" | "description" | "estimatedPrice" | "source" | "url" | "fitmentNote" | "isRequired"
  > {
  category: RecCategory;
  costRangeMin: number;
  costRangeMax: number;
}

function rec(args: SeedRec): SeedRec {
  return args;
}

const ALWAYS_RECOMMENDED_TOOLS: SeedRec[] = [
  rec({
    type: "tool",
    category: "required_tool",
    title: "OBD2 Scanner",
    description: "Reads diagnostic trouble codes and live engine data. Foundational tool for almost any case.",
    estimatedPrice: "$30-150",
    costRangeMin: 30,
    costRangeMax: 150,
    source: "Affiliate",
    url: null,
    fitmentNote: null,
    isRequired: true,
  }),
  rec({
    type: "tool",
    category: "optional_tool",
    title: "Multimeter",
    description: "Measures voltage, resistance, and continuity. Useful for any electrical-adjacent diagnosis.",
    estimatedPrice: "$25-80",
    costRangeMin: 25,
    costRangeMax: 80,
    source: "Affiliate",
    url: null,
    fitmentNote: null,
    isRequired: false,
  }),
];

const SAFETY_KIT: SeedRec[] = [
  rec({
    type: "tool",
    category: "safety_equipment",
    title: "Safety Glasses",
    description: "Protect your eyes from debris, fluids, and sparks. Required for any underhood work.",
    estimatedPrice: "$8-25",
    costRangeMin: 8,
    costRangeMax: 25,
    source: "Affiliate",
    url: null,
    fitmentNote: null,
    isRequired: true,
  }),
  rec({
    type: "tool",
    category: "safety_equipment",
    title: "Mechanic Gloves",
    description: "Cut and chemical resistant gloves for working around hot or sharp components.",
    estimatedPrice: "$10-25",
    costRangeMin: 10,
    costRangeMax: 25,
    source: "Affiliate",
    url: null,
    fitmentNote: null,
    isRequired: false,
  }),
];

const MISFIRE_RECS: SeedRec[] = [
  rec({ type: "tool", category: "required_tool", title: "Spark Plug Socket", description: "Thin-wall socket with rubber insert to grip plugs without cracking porcelain.", estimatedPrice: "$10-25", costRangeMin: 10, costRangeMax: 25, source: "Affiliate", url: null, fitmentNote: "Verify size (5/8\", 13/16\", 14mm) for your engine.", isRequired: true }),
  rec({ type: "tool", category: "optional_tool", title: "Compression Tester", description: "Confirms cylinder mechanical health if a coil/plug swap doesn't resolve the misfire.", estimatedPrice: "$30-90", costRangeMin: 30, costRangeMax: 90, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "tool", category: "optional_tool", title: "Noid Light", description: "Verifies the injector is being pulsed by the ECU.", estimatedPrice: "$15-40", costRangeMin: 15, costRangeMax: 40, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "part", category: "likely_part", title: "Spark Plugs (set)", description: "Replace as a set. Match heat range and gap from your service manual.", estimatedPrice: "$20-80", costRangeMin: 20, costRangeMax: 80, source: "Affiliate", url: null, fitmentNote: "Match brand/heat range to OEM spec — check FSM for gap.", isRequired: false }),
  rec({ type: "part", category: "likely_part", title: "Ignition Coil", description: "Common cause of single-cylinder misfires. Swap with a known-good coil to confirm.", estimatedPrice: "$25-150", costRangeMin: 25, costRangeMax: 150, source: "Affiliate", url: null, fitmentNote: "Confirm fitment by year/make/model/engine.", isRequired: false }),
  rec({ type: "part", category: "likely_part", title: "Fuel Injector", description: "Replace if injector is electrically dead or sticking. Often less common than coil failures.", estimatedPrice: "$50-300", costRangeMin: 50, costRangeMax: 300, source: "Affiliate", url: null, fitmentNote: "Confirm fitment — match part number.", isRequired: false }),
  rec({ type: "consumable", category: "consumable", title: "Dielectric Grease", description: "Apply on coil boot interiors to seal moisture and ease future plug removal.", estimatedPrice: "$5-12", costRangeMin: 5, costRangeMax: 12, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
];

const BRAKE_RECS: SeedRec[] = [
  rec({ type: "part", category: "likely_part", title: "Brake Pads", description: "Replace as axle set. Choose pad compound based on driving style.", estimatedPrice: "$30-120", costRangeMin: 30, costRangeMax: 120, source: "Affiliate", url: null, fitmentNote: "Confirm front vs rear and pad shape per VIN.", isRequired: true }),
  rec({ type: "part", category: "likely_part", title: "Brake Rotors", description: "If rotors are below minimum thickness or have heavy lateral runout, replace as a pair.", estimatedPrice: "$40-200", costRangeMin: 40, costRangeMax: 200, source: "Affiliate", url: null, fitmentNote: "Verify diameter and stud pattern.", isRequired: false }),
  rec({ type: "part", category: "likely_part", title: "Caliper Hardware Kit", description: "Refresh slides and clips when replacing pads to avoid uneven wear.", estimatedPrice: "$10-30", costRangeMin: 10, costRangeMax: 30, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "tool", category: "optional_tool", title: "Dial Indicator", description: "Measures rotor lateral runout. Helps confirm whether vibration is rotor-induced.", estimatedPrice: "$20-60", costRangeMin: 20, costRangeMax: 60, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "tool", category: "required_tool", title: "Torque Wrench", description: "Required to torque lug nuts and caliper bolts to spec.", estimatedPrice: "$40-120", costRangeMin: 40, costRangeMax: 120, source: "Affiliate", url: null, fitmentNote: null, isRequired: true }),
  rec({ type: "tool", category: "required_tool", title: "Jack Stands (pair)", description: "Never trust a jack alone. Required for any wheel-off work.", estimatedPrice: "$40-120", costRangeMin: 40, costRangeMax: 120, source: "Affiliate", url: null, fitmentNote: null, isRequired: true }),
  rec({ type: "consumable", category: "consumable", title: "Brake Cleaner", description: "Cleans dust and oil from rotors before reassembly.", estimatedPrice: "$5-10", costRangeMin: 5, costRangeMax: 10, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "consumable", category: "consumable", title: "Anti-Squeal Lubricant", description: "Apply to pad backing plates to silence brake squeal.", estimatedPrice: "$5-12", costRangeMin: 5, costRangeMax: 12, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
];

const NO_START_RECS: SeedRec[] = [
  rec({ type: "tool", category: "required_tool", title: "Battery Tester", description: "Confirms battery state-of-health and cranking amps. Rules out the most common no-start cause.", estimatedPrice: "$30-150", costRangeMin: 30, costRangeMax: 150, source: "Affiliate", url: null, fitmentNote: null, isRequired: true }),
  rec({ type: "tool", category: "optional_tool", title: "Test Light", description: "Quickly verifies power and ground at the starter, fuel pump, and ignition.", estimatedPrice: "$10-25", costRangeMin: 10, costRangeMax: 25, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "tool", category: "optional_tool", title: "Fuel Pressure Tester", description: "Confirms fuel pump and regulator are producing spec pressure at the rail.", estimatedPrice: "$50-180", costRangeMin: 50, costRangeMax: 180, source: "Affiliate", url: null, fitmentNote: "Check for the correct test port adapter for your engine.", isRequired: false }),
  rec({ type: "part", category: "likely_part", title: "Starter Relay", description: "Cheap part that fails often. Swap with a matching relay from a non-critical circuit to confirm.", estimatedPrice: "$10-30", costRangeMin: 10, costRangeMax: 30, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
];

const COOLING_RECS: SeedRec[] = [
  rec({ type: "part", category: "likely_part", title: "Thermostat", description: "Stuck-closed thermostat is the most common overheating cause on higher-mileage engines.", estimatedPrice: "$15-40", costRangeMin: 15, costRangeMax: 40, source: "Affiliate", url: null, fitmentNote: "Match opening temp to OEM spec.", isRequired: false }),
  rec({ type: "consumable", category: "consumable", title: "Coolant (correct spec)", description: "Top off only with the manufacturer-specified coolant chemistry.", estimatedPrice: "$15-40", costRangeMin: 15, costRangeMax: 40, source: "Affiliate", url: null, fitmentNote: "Wrong coolant chemistry can corrode aluminum components.", isRequired: false }),
  rec({ type: "tool", category: "optional_tool", title: "Cooling System Pressure Tester", description: "Pressurizes the system to find external and internal leaks.", estimatedPrice: "$80-250", costRangeMin: 80, costRangeMax: 250, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
];

const ELECTRICAL_RECS: SeedRec[] = [
  rec({ type: "tool", category: "optional_tool", title: "Clamp-on DC Ammeter", description: "Measures parasitic draw without breaking the circuit.", estimatedPrice: "$60-200", costRangeMin: 60, costRangeMax: 200, source: "Affiliate", url: null, fitmentNote: null, isRequired: false }),
  rec({ type: "part", category: "likely_part", title: "Battery", description: "If the battery is over 4-5 years old or fails a load test, replace it.", estimatedPrice: "$120-300", costRangeMin: 120, costRangeMax: 300, source: "Affiliate", url: null, fitmentNote: "Match group size and CCA.", isRequired: false }),
];

interface Match {
  pattern: RegExp;
  recs: SeedRec[];
}

const DTC_MATCHES: Match[] = [
  { pattern: /^P030[0-9]/, recs: MISFIRE_RECS },
  { pattern: /^P017[1-4]/, recs: MISFIRE_RECS },
  { pattern: /^P012[0-9]/, recs: COOLING_RECS },
  { pattern: /^P0217/, recs: COOLING_RECS },
  { pattern: /^P05(62|63)/, recs: ELECTRICAL_RECS },
];

const SYSTEM_MATCHES: Record<string, SeedRec[]> = {
  brakes: BRAKE_RECS,
  cooling: COOLING_RECS,
  electrical: ELECTRICAL_RECS,
  engine: MISFIRE_RECS,
  fuel: MISFIRE_RECS,
};

const KEYWORD_MATCHES: { keywords: string[]; recs: SeedRec[] }[] = [
  { keywords: ["misfire", "misfiring", "rough idle", "rough running", "stumble"], recs: MISFIRE_RECS },
  { keywords: ["brake vibration", "brake vibrate", "steering wheel shake", "shake when braking", "pedal pulsation", "rotor warp"], recs: BRAKE_RECS },
  { keywords: ["no start", "no-start", "won't start", "wont start", "no crank", "no-crank", "click no start"], recs: NO_START_RECS },
  { keywords: ["overheat", "overheating", "running hot", "coolant leak", "white smoke"], recs: COOLING_RECS },
  { keywords: ["parasitic drain", "battery dead", "battery drain", "battery dies"], recs: ELECTRICAL_RECS },
];

export interface RecommendationContext {
  obdCodes?: string[] | null;
  systemCategory?: string | null;
  symptoms?: string[] | null;
  title?: string | null;
}

export function getContextRecommendations(ctx: RecommendationContext): SeedRec[] {
  const seen = new Set<string>();
  const out: SeedRec[] = [];

  const push = (recs: SeedRec[]) => {
    for (const r of recs) {
      const key = `${r.type}::${r.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
  };

  push(ALWAYS_RECOMMENDED_TOOLS);
  push(SAFETY_KIT);

  if (ctx.obdCodes && ctx.obdCodes.length > 0) {
    for (const code of ctx.obdCodes) {
      const upper = code.toUpperCase().trim();
      for (const m of DTC_MATCHES) {
        if (m.pattern.test(upper)) {
          push(m.recs);
        }
      }
    }
  }

  if (ctx.systemCategory) {
    const sysRecs = SYSTEM_MATCHES[ctx.systemCategory.toLowerCase()];
    if (sysRecs) {
      push(sysRecs);
    }
  }

  const text = [ctx.title ?? "", ...(ctx.symptoms ?? [])].join(" ").toLowerCase();
  if (text.trim().length > 0) {
    for (const m of KEYWORD_MATCHES) {
      if (m.keywords.some((kw) => text.includes(kw))) {
        push(m.recs);
      }
    }
  }

  return out;
}

export function summarizeCostRange(recs: SeedRec[]): { min: number; max: number; label: string } {
  const min = recs.reduce((a, r) => a + (r.costRangeMin || 0), 0);
  const max = recs.reduce((a, r) => a + (r.costRangeMax || 0), 0);
  return { min, max, label: `$${min.toLocaleString()}-$${max.toLocaleString()}` };
}
