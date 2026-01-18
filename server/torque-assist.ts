import type { 
  TorqueAssistRequest, 
  TorqueAssistResponse, 
  DecodedVehicle,
  TorqueAssistError 
} from "@shared/torque-assist";

const responseCache = new Map<string, { response: TorqueAssistResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Rate Limiter Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX = 10; // 10 requests per window

// ============================================================================
// IN-MEMORY RATE LIMITER
// NOTE: This in-memory implementation will NOT scale across multiple instances.
// Each instance maintains its own counter, so users could exceed limits by 
// hitting different instances. For multi-instance deployments, use the Redis
// implementation by setting REDIS_URL environment variable.
// ============================================================================
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Redis client singleton (lazy-loaded when REDIS_URL is set)
// Type defined inline to avoid requiring ioredis types when not installed
interface RedisClientLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

let redisClient: RedisClientLike | null = null;
let redisEnabled = false;

// Initialize Redis if REDIS_URL is configured
async function initRedis(): Promise<void> {
  if (redisClient !== null || !process.env.REDIS_URL) {
    return;
  }
  
  try {
    // Dynamic import - ioredis must be installed separately
    // @ts-expect-error ioredis is an optional dependency, only loaded when REDIS_URL is set
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.REDIS_URL);
    
    client.on("error", (err: Error) => {
      console.error("[RateLimiter] Redis error, falling back to in-memory:", err.message);
      redisEnabled = false;
    });
    
    client.on("connect", () => {
      console.log("[RateLimiter] Redis connected - rate limiting will scale across instances");
      redisEnabled = true;
    });
    
    redisClient = client as unknown as RedisClientLike;
  } catch (err) {
    console.warn("[RateLimiter] Failed to initialize Redis, using in-memory limiter:", err);
    redisEnabled = false;
  }
}

// Attempt Redis initialization on module load
initRedis().catch(() => {});

// In-memory rate limit check
function checkRateLimitInMemory(clientId: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(clientId);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

// Redis-backed rate limit check (sliding window counter)
async function checkRateLimitRedis(clientId: string): Promise<boolean> {
  if (!redisClient || !redisEnabled) {
    return checkRateLimitInMemory(clientId);
  }
  
  const key = `ratelimit:torqueassist:${clientId}`;
  const windowSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  
  try {
    const current = await redisClient.incr(key);
    
    if (current === 1) {
      await redisClient.expire(key, windowSeconds);
    }
    
    return current <= RATE_LIMIT_MAX;
  } catch (err) {
    console.error("[RateLimiter] Redis check failed, falling back to in-memory:", err);
    return checkRateLimitInMemory(clientId);
  }
}

// Main rate limit function - uses Redis if available, otherwise in-memory
export function checkRateLimit(clientId: string): boolean {
  // For synchronous compatibility, check Redis status
  // If Redis is enabled, we need async handling in the route
  if (redisEnabled && redisClient) {
    // Return true and let async check happen separately
    // This maintains backward compatibility with sync callers
    return true;
  }
  return checkRateLimitInMemory(clientId);
}

// Async rate limit check for routes that can handle promises
export async function checkRateLimitAsync(clientId: string): Promise<boolean> {
  if (redisEnabled && redisClient) {
    return checkRateLimitRedis(clientId);
  }
  return checkRateLimitInMemory(clientId);
}

// Check if Redis rate limiting is active
export function isRedisRateLimitEnabled(): boolean {
  return redisEnabled;
}

function getCacheKey(request: TorqueAssistRequest): string {
  const vehicleKey = request.vehicle.type === "vin" 
    ? request.vehicle.vin 
    : `${request.vehicle.year}-${request.vehicle.make}-${request.vehicle.model}`;
  return `${vehicleKey}:${request.issue.toLowerCase().trim()}`;
}

export function getCachedResponse(request: TorqueAssistRequest): TorqueAssistResponse | null {
  const key = getCacheKey(request);
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.response;
  }
  
  if (cached) {
    responseCache.delete(key);
  }
  
  return null;
}

export function cacheResponse(request: TorqueAssistRequest, response: TorqueAssistResponse): void {
  const key = getCacheKey(request);
  responseCache.set(key, { response, timestamp: Date.now() });
}

export function decodeVin(vin: string): DecodedVehicle {
  const vinPatterns: Record<string, Partial<DecodedVehicle>> = {
    "1FT": { make: "Ford", model: "F-Series" },
    "1FA": { make: "Ford", model: "Mustang" },
    "1G1": { make: "Chevrolet", model: "Camaro" },
    "1GC": { make: "Chevrolet", model: "Silverado" },
    "2C3": { make: "Dodge", model: "Challenger" },
    "1C4": { make: "Jeep", model: "Wrangler" },
    "1J4": { make: "Jeep", model: "Grand Cherokee" },
  };
  
  const prefix = vin.substring(0, 3).toUpperCase();
  const yearChar = vin.charAt(9);
  const yearMap: Record<string, number> = {
    "K": 2019, "L": 2020, "M": 2021, "N": 2022, "P": 2023, "R": 2024, "S": 2025,
    "J": 2018, "H": 2017, "G": 2016, "F": 2015, "E": 2014, "D": 2013,
  };
  
  const pattern = vinPatterns[prefix];
  const year = yearMap[yearChar] || 2020;
  
  return {
    year,
    make: pattern?.make || "Unknown",
    model: pattern?.model || "Vehicle",
    trim: null,
    engine: "V8 5.0L",
    transmission: "Automatic",
    drivetrain: "4WD",
  };
}

interface IssuePattern {
  keywords: string[];
  normalizedName: string;
  likelyCauses: Array<{ cause: string; probability: "high" | "medium" | "low"; explanation: string }>;
  checks: Array<{ action: string; tools: string[]; difficulty: "beginner" | "intermediate" | "advanced" }>;
  torqueSpecs: Array<{ component: string; spec: string; notes: string | null }> | null;
  parts: Array<{ name: string; category: string; priority: "high" | "medium" | "low"; estimatedCost: string | null }>;
  confidence: "common_issue" | "vehicle_specific" | "general_guidance" | "requires_diagnosis";
}

const issuePatterns: IssuePattern[] = [
  {
    keywords: ["brake", "brakes", "squeaking", "squeal", "grinding", "stopping"],
    normalizedName: "Brake System Issue",
    likelyCauses: [
      { cause: "Worn brake pads", probability: "high", explanation: "Brake pads wear down over time and need replacement every 25,000-70,000 miles" },
      { cause: "Warped rotors", probability: "medium", explanation: "Excessive heat can cause rotors to warp, leading to pulsation when braking" },
      { cause: "Stuck caliper", probability: "low", explanation: "A seized caliper can cause uneven wear and overheating" },
    ],
    checks: [
      { action: "Visually inspect brake pad thickness through wheel spokes", tools: ["Flashlight"], difficulty: "beginner" },
      { action: "Check rotor surface for scoring or grooves", tools: ["Flashlight", "Inspection mirror"], difficulty: "beginner" },
      { action: "Measure rotor thickness with micrometer", tools: ["Micrometer", "Jack", "Jack stands"], difficulty: "intermediate" },
      { action: "Check brake fluid level and condition", tools: [], difficulty: "beginner" },
    ],
    torqueSpecs: [
      { component: "Caliper bracket bolts", spec: "85-95 ft-lbs", notes: "Use thread locker" },
      { component: "Caliper slide pins", spec: "25-35 ft-lbs", notes: "Apply brake grease" },
      { component: "Wheel lug nuts", spec: "100-110 ft-lbs", notes: "Torque in star pattern" },
    ],
    parts: [
      { name: "Brake pad set (front)", category: "Brakes", priority: "high", estimatedCost: "$30-80" },
      { name: "Brake rotor (each)", category: "Brakes", priority: "medium", estimatedCost: "$40-100" },
      { name: "Brake caliper", category: "Brakes", priority: "low", estimatedCost: "$60-150" },
    ],
    confidence: "common_issue",
  },
  {
    keywords: ["oil", "leak", "drip", "spot", "puddle"],
    normalizedName: "Oil Leak",
    likelyCauses: [
      { cause: "Valve cover gasket failure", probability: "high", explanation: "Gasket material degrades over time, especially with heat cycles" },
      { cause: "Oil pan gasket leak", probability: "medium", explanation: "Lower engine leaks often from pan gasket, especially after impact" },
      { cause: "Rear main seal", probability: "low", explanation: "Requires transmission removal, typically on high-mileage vehicles" },
    ],
    checks: [
      { action: "Clean engine bay and add UV dye to oil, then inspect with UV light", tools: ["UV dye kit", "UV flashlight"], difficulty: "beginner" },
      { action: "Check oil level and look for obvious drip points", tools: ["Flashlight"], difficulty: "beginner" },
      { action: "Pressure test oil system", tools: ["Oil pressure tester"], difficulty: "intermediate" },
    ],
    torqueSpecs: [
      { component: "Valve cover bolts", spec: "7-10 ft-lbs", notes: "Tighten in sequence from center out" },
      { component: "Oil pan bolts", spec: "15-22 ft-lbs", notes: "Use new gasket, torque in crosshatch pattern" },
      { component: "Oil drain plug", spec: "20-25 ft-lbs", notes: "Use new crush washer" },
    ],
    parts: [
      { name: "Valve cover gasket set", category: "Engine", priority: "high", estimatedCost: "$15-50" },
      { name: "Oil pan gasket", category: "Engine", priority: "medium", estimatedCost: "$20-60" },
      { name: "Oil drain plug with washer", category: "Engine", priority: "low", estimatedCost: "$5-15" },
    ],
    confidence: "common_issue",
  },
  {
    keywords: ["start", "starting", "crank", "cranking", "battery", "dead", "won't start", "no start"],
    normalizedName: "Starting System Issue",
    likelyCauses: [
      { cause: "Dead or weak battery", probability: "high", explanation: "Batteries typically last 3-5 years; cold weather accelerates failure" },
      { cause: "Corroded battery terminals", probability: "medium", explanation: "Corrosion prevents proper electrical contact" },
      { cause: "Failed starter motor", probability: "low", explanation: "Starter solenoid or motor failure, often clicks but won't engage" },
    ],
    checks: [
      { action: "Test battery voltage with multimeter (should be 12.4-12.7V)", tools: ["Multimeter"], difficulty: "beginner" },
      { action: "Inspect battery terminals for corrosion", tools: ["Flashlight"], difficulty: "beginner" },
      { action: "Load test battery", tools: ["Battery load tester"], difficulty: "intermediate" },
      { action: "Test starter draw current", tools: ["Amp clamp", "Multimeter"], difficulty: "advanced" },
    ],
    torqueSpecs: [
      { component: "Battery terminal bolts", spec: "5-7 ft-lbs", notes: "Do not overtighten" },
      { component: "Starter mounting bolts", spec: "30-40 ft-lbs", notes: "Varies by vehicle" },
    ],
    parts: [
      { name: "Automotive battery", category: "Electrical", priority: "high", estimatedCost: "$100-200" },
      { name: "Battery terminal cleaner/brush", category: "Electrical", priority: "medium", estimatedCost: "$5-10" },
      { name: "Starter motor", category: "Electrical", priority: "low", estimatedCost: "$100-300" },
    ],
    confidence: "common_issue",
  },
  {
    keywords: ["check engine", "cel", "light", "code", "p0", "emissions"],
    normalizedName: "Check Engine Light Diagnosis",
    likelyCauses: [
      { cause: "Loose or damaged gas cap", probability: "high", explanation: "EVAP system leak from improper seal is very common" },
      { cause: "Oxygen sensor failure", probability: "medium", explanation: "O2 sensors degrade over time affecting fuel mixture" },
      { cause: "Catalytic converter efficiency", probability: "low", explanation: "Catalyst degradation triggers P0420/P0430 codes" },
    ],
    checks: [
      { action: "Scan for diagnostic trouble codes (DTCs)", tools: ["OBD2 scanner"], difficulty: "beginner" },
      { action: "Check gas cap seal and tighten", tools: [], difficulty: "beginner" },
      { action: "Inspect for vacuum leaks with smoke machine", tools: ["Smoke machine"], difficulty: "intermediate" },
      { action: "Monitor live sensor data for anomalies", tools: ["OBD2 scanner with live data"], difficulty: "intermediate" },
    ],
    torqueSpecs: null,
    parts: [
      { name: "Gas cap with seal", category: "Fuel System", priority: "high", estimatedCost: "$10-25" },
      { name: "Oxygen sensor", category: "Emissions", priority: "medium", estimatedCost: "$30-100" },
      { name: "Mass airflow sensor", category: "Engine", priority: "medium", estimatedCost: "$40-150" },
    ],
    confidence: "requires_diagnosis",
  },
];

function findMatchingPattern(issue: string): IssuePattern | null {
  const lowerIssue = issue.toLowerCase();
  
  for (const pattern of issuePatterns) {
    if (pattern.keywords.some(keyword => lowerIssue.includes(keyword))) {
      return pattern;
    }
  }
  
  return null;
}

function generateStubLinks(make: string): Array<{ provider: string; url: string; type: "oem" | "aftermarket" | "used" }> {
  return [
    { provider: "RockAuto", url: "https://www.rockauto.com", type: "aftermarket" },
    { provider: "AutoZone", url: "https://www.autozone.com", type: "aftermarket" },
    { provider: `${make} Parts Direct`, url: `https://parts.${make.toLowerCase()}.com`, type: "oem" },
    { provider: "Car-Part.com", url: "https://www.car-part.com", type: "used" },
  ];
}

interface PartInfo {
  name: string;
  category: string;
  priority: "high" | "medium" | "low";
  estimatedCost: string | null;
}

function generatePurchaseOptions(parts: PartInfo[], make: string): Array<{
  vendorName: string;
  priceRange: string | null;
  affiliateUrl: string | null;
  disclosureFlag: boolean;
  partName: string;
  type: "oem" | "aftermarket" | "used";
}> {
  const vendorData: Array<{
    name: string;
    type: "oem" | "aftermarket" | "used";
    hasAffiliate: boolean;
    baseUrl: string | null;
  }> = [
    { name: "RockAuto", type: "aftermarket", hasAffiliate: true, baseUrl: "https://www.rockauto.com" },
    { name: "AutoZone", type: "aftermarket", hasAffiliate: true, baseUrl: "https://www.autozone.com" },
    { name: "O'Reilly Auto Parts", type: "aftermarket", hasAffiliate: false, baseUrl: "https://www.oreillyauto.com" },
    { name: "Advance Auto Parts", type: "aftermarket", hasAffiliate: true, baseUrl: "https://www.advanceautoparts.com" },
    { name: `${make} Parts Direct`, type: "oem", hasAffiliate: false, baseUrl: null },
    { name: "Car-Part.com", type: "used", hasAffiliate: false, baseUrl: "https://www.car-part.com" },
  ];

  const options: Array<{
    vendorName: string;
    priceRange: string | null;
    affiliateUrl: string | null;
    disclosureFlag: boolean;
    partName: string;
    type: "oem" | "aftermarket" | "used";
  }> = [];

  for (const part of parts) {
    const relevantVendors = vendorData.slice(0, 3);
    
    for (const vendor of relevantVendors) {
      options.push({
        vendorName: vendor.name,
        priceRange: part.estimatedCost,
        affiliateUrl: vendor.hasAffiliate ? vendor.baseUrl : null,
        disclosureFlag: vendor.hasAffiliate,
        partName: part.name,
        type: vendor.type,
      });
    }
  }

  return options;
}

export function generateTorqueAssistResponse(request: TorqueAssistRequest): TorqueAssistResponse {
  let vehicle: DecodedVehicle;
  
  if (request.vehicle.type === "vin" && request.vehicle.vin) {
    vehicle = decodeVin(request.vehicle.vin);
  } else {
    vehicle = {
      year: request.vehicle.year!,
      make: request.vehicle.make!,
      model: request.vehicle.model!,
      trim: null,
      engine: null,
      transmission: null,
      drivetrain: null,
    };
  }
  
  const pattern = findMatchingPattern(request.issue);
  
  if (!pattern) {
    return {
      vehicle,
      normalizedIssue: request.issue,
      likelyCauses: [
        { cause: "Unable to determine specific cause", probability: "medium", explanation: "Please provide more details about the symptoms you're experiencing" },
      ],
      recommendedChecks: [
        { step: 1, action: "Document when the issue occurs (cold start, hot, under load, etc.)", tools: [], difficulty: "beginner" },
        { step: 2, action: "Check for any warning lights on dashboard", tools: [], difficulty: "beginner" },
        { step: 3, action: "Consult vehicle service manual for troubleshooting", tools: ["Service manual"], difficulty: "intermediate" },
      ],
      torqueSpecs: null,
      suggestedParts: [],
      purchaseLinks: generateStubLinks(vehicle.make),
      purchaseOptions: [],
      confidenceNote: "general_guidance",
      disclaimer: "This is general guidance. For accurate diagnosis, consult a qualified mechanic or your vehicle's service manual.",
    };
  }
  
  return {
    vehicle,
    normalizedIssue: pattern.normalizedName,
    likelyCauses: pattern.likelyCauses,
    recommendedChecks: pattern.checks.map((check, index) => ({
      step: index + 1,
      ...check,
    })),
    torqueSpecs: pattern.torqueSpecs,
    suggestedParts: pattern.parts,
    purchaseLinks: generateStubLinks(vehicle.make),
    purchaseOptions: generatePurchaseOptions(pattern.parts, vehicle.make),
    confidenceNote: pattern.confidence,
    disclaimer: `This guidance is based on common ${pattern.normalizedName.toLowerCase()} issues for ${vehicle.year} ${vehicle.make} ${vehicle.model}. Always verify specifications with your vehicle's service manual.`,
  };
}

export function validateRequest(body: unknown): { valid: true; data: TorqueAssistRequest } | { valid: false; error: TorqueAssistError } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: { code: "INVALID_REQUEST", message: "Request body must be a JSON object" } };
  }
  
  const { vehicle, issue } = body as Record<string, unknown>;
  
  if (!vehicle || typeof vehicle !== "object") {
    return { valid: false, error: { code: "MISSING_VEHICLE", message: "Vehicle information is required" } };
  }
  
  const v = vehicle as Record<string, unknown>;
  
  if (v.type !== "vin" && v.type !== "ymm") {
    return { valid: false, error: { code: "INVALID_VEHICLE_TYPE", message: "Vehicle type must be 'vin' or 'ymm'" } };
  }
  
  if (v.type === "vin") {
    if (!v.vin || typeof v.vin !== "string" || v.vin.length !== 17) {
      return { valid: false, error: { code: "INVALID_VIN", message: "VIN must be exactly 17 characters" } };
    }
  } else {
    if (!v.year || !v.make || !v.model) {
      return { valid: false, error: { code: "INVALID_YMM", message: "Year, make, and model are all required" } };
    }
  }
  
  if (!issue || typeof issue !== "string" || issue.trim().length < 3) {
    return { valid: false, error: { code: "INVALID_ISSUE", message: "Issue description must be at least 3 characters" } };
  }
  
  if (issue.length > 500) {
    return { valid: false, error: { code: "ISSUE_TOO_LONG", message: "Issue description must be 500 characters or less" } };
  }
  
  return {
    valid: true,
    data: {
      vehicle: v.type === "vin" 
        ? { type: "vin", vin: v.vin as string }
        : { type: "ymm", year: Number(v.year), make: String(v.make), model: String(v.model) },
      issue: issue.trim(),
    },
  };
}
