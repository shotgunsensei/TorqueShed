export interface VehicleProfile {
  year?: number;
  make?: string;
  model?: string;
  engine?: string;
  drivetrain?: string;
  transmission?: string;
  mileage?: number;
  vin?: string;
}

export type DiagnosticPhase = "intake" | "category" | "narrowing" | "diagnosis";

export interface TestResult {
  result: "pass" | "fail" | "inconclusive";
  notes: string;
  completedAt: string;
}

export interface DiagnosticSessionData {
  id?: string;
  vehicle: VehicleProfile;
  recentRepairs: string;
  dtcCodes: string[];
  categoryId: string | null;
  answers: Record<string, string>;
  completedTests: Record<string, TestResult>;
  notes: string;
  phase: DiagnosticPhase;
  createdAt?: string;
}

export interface HypothesisTemplate {
  id: string;
  name: string;
  baseConfidence: number;
  description: string;
  difficulty: "easy" | "moderate" | "hard";
  costRange: string;
  safetyLevel: "diy-safe" | "use-caution" | "professional";
  toolLevel: string;
}

export interface QuestionOption {
  label: string;
  value: string;
  effects: { hypothesisId: string; delta: number }[];
}

export interface NarrowingQuestion {
  id: string;
  text: string;
  whyAsking: string;
  options: QuestionOption[];
  prerequisites?: { questionId: string; values: string[] }[];
}

export interface DiagnosticTest {
  id: string;
  name: string;
  purpose: string;
  tools: string[];
  procedure: string;
  expectedGood: string;
  expectedBad: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  discriminates: string[];
  passEffects: { hypothesisId: string; delta: number }[];
  failEffects: { hypothesisId: string; delta: number }[];
}

export interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  hypotheses: HypothesisTemplate[];
  questions: NarrowingQuestion[];
  tests: DiagnosticTest[];
}

export interface ScoredHypothesis {
  id: string;
  name: string;
  confidence: number;
  rawScore: number;
  description: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  difficulty: "easy" | "moderate" | "hard";
  costRange: string;
  safetyLevel: "diy-safe" | "use-caution" | "professional";
  toolLevel: string;
  nextTest: DiagnosticTest | null;
}

export interface DiagnosticAssessment {
  summary: string;
  hypotheses: ScoredHypothesis[];
  nextQuestion: NarrowingQuestion | null;
  nextTest: DiagnosticTest | null;
  progress: number;
  answeredCount: number;
  totalQuestions: number;
}

export interface ExportSummary {
  vehicle: VehicleProfile;
  complaint: string;
  symptoms: string[];
  dtcCodes: string[];
  recentRepairs: string;
  testsPerformed: { name: string; result: string; notes: string }[];
  likelyCauses: { name: string; confidence: number; description: string }[];
  recommendedNextStep: string;
  notes: string;
  generatedAt: string;
}

const noCrank: CategoryDefinition = {
  id: "no-crank",
  name: "No Crank",
  icon: "battery",
  description: "Key turns but engine does not crank at all",
  hypotheses: [
    { id: "nc-battery", name: "Dead or weak battery", baseConfidence: 35, description: "Battery has insufficient charge or capacity to engage the starter. Batteries typically last 3-5 years and fail faster in extreme temps.", difficulty: "easy", costRange: "$100-200", safetyLevel: "diy-safe", toolLevel: "Multimeter" },
    { id: "nc-terminals", name: "Corroded or loose battery terminals", baseConfidence: 20, description: "Corrosion or loose connections at the battery posts prevent current flow to the starter circuit.", difficulty: "easy", costRange: "$5-15", safetyLevel: "diy-safe", toolLevel: "Wire brush, wrench" },
    { id: "nc-starter", name: "Failed starter motor or solenoid", baseConfidence: 20, description: "The starter motor itself has failed or its solenoid cannot engage the flywheel ring gear.", difficulty: "moderate", costRange: "$150-400", safetyLevel: "use-caution", toolLevel: "Jack, socket set" },
    { id: "nc-ground", name: "High-resistance ground or power cable", baseConfidence: 12, description: "Engine-to-chassis ground strap or positive battery cable has internal corrosion causing voltage drop.", difficulty: "moderate", costRange: "$20-80", safetyLevel: "diy-safe", toolLevel: "Multimeter" },
    { id: "nc-relay", name: "Starter relay or ignition switch failure", baseConfidence: 8, description: "The relay that triggers the starter solenoid or the ignition switch contacts have failed.", difficulty: "moderate", costRange: "$15-60", safetyLevel: "diy-safe", toolLevel: "Test light, multimeter" },
    { id: "nc-lockup", name: "Mechanical engine lockup", baseConfidence: 5, description: "Engine is seized from hydro-lock, bearing failure, or timing component failure. Rare but serious.", difficulty: "hard", costRange: "$1000+", safetyLevel: "professional", toolLevel: "Breaker bar on crank bolt" },
  ],
  questions: [
    { id: "nc-q1", text: "What happens when you turn the key to start?", whyAsking: "The sound (or silence) at the starter tells us whether the problem is power delivery, starter engagement, or mechanical.", options: [
      { label: "Complete silence - nothing at all", value: "silence", effects: [{ hypothesisId: "nc-battery", delta: 15 }, { hypothesisId: "nc-relay", delta: 20 }, { hypothesisId: "nc-terminals", delta: 10 }] },
      { label: "Single heavy click from starter area", value: "click", effects: [{ hypothesisId: "nc-starter", delta: 30 }, { hypothesisId: "nc-ground", delta: 15 }, { hypothesisId: "nc-battery", delta: -10 }] },
      { label: "Rapid clicking sound", value: "rapid-click", effects: [{ hypothesisId: "nc-battery", delta: 25 }, { hypothesisId: "nc-terminals", delta: 15 }, { hypothesisId: "nc-starter", delta: -10 }] },
      { label: "Grinding or whirring noise", value: "grinding", effects: [{ hypothesisId: "nc-starter", delta: 20 }, { hypothesisId: "nc-lockup", delta: 15 }] },
    ] },
    { id: "nc-q2", text: "Do the dashboard lights come on bright when you turn the key to ON (not start)?", whyAsking: "If dash lights are bright, the battery has charge and the problem is downstream. Dim or no lights points to the battery or its connections.", options: [
      { label: "Yes, bright and normal", value: "bright", effects: [{ hypothesisId: "nc-battery", delta: -15 }, { hypothesisId: "nc-starter", delta: 10 }, { hypothesisId: "nc-relay", delta: 10 }] },
      { label: "Dim or flickering", value: "dim", effects: [{ hypothesisId: "nc-battery", delta: 20 }, { hypothesisId: "nc-terminals", delta: 15 }] },
      { label: "No lights at all", value: "none", effects: [{ hypothesisId: "nc-battery", delta: 25 }, { hypothesisId: "nc-terminals", delta: 20 }, { hypothesisId: "nc-starter", delta: -15 }] },
    ] },
    { id: "nc-q3", text: "Have you tried jump-starting the vehicle?", whyAsking: "If a jump start works, the battery or its connections are the weak link. If it still won't crank with a jump, the starter or mechanical issue is more likely.", options: [
      { label: "Yes, it cranked with a jump", value: "jump-worked", effects: [{ hypothesisId: "nc-battery", delta: 25 }, { hypothesisId: "nc-terminals", delta: 10 }, { hypothesisId: "nc-starter", delta: -20 }, { hypothesisId: "nc-lockup", delta: -15 }] },
      { label: "Tried jumping, still nothing", value: "jump-failed", effects: [{ hypothesisId: "nc-starter", delta: 20 }, { hypothesisId: "nc-ground", delta: 15 }, { hypothesisId: "nc-lockup", delta: 10 }, { hypothesisId: "nc-battery", delta: -20 }] },
      { label: "Haven't tried yet", value: "not-tried", effects: [] },
    ] },
    { id: "nc-q4", text: "How old is your battery?", whyAsking: "Batteries degrade with age. A battery over 4 years old in a hot climate or 5+ years in temperate conditions is likely near end of life.", options: [
      { label: "Less than 2 years", value: "new", effects: [{ hypothesisId: "nc-battery", delta: -15 }, { hypothesisId: "nc-terminals", delta: 5 }] },
      { label: "2-4 years", value: "mid", effects: [{ hypothesisId: "nc-battery", delta: 5 }] },
      { label: "Over 4 years or unknown", value: "old", effects: [{ hypothesisId: "nc-battery", delta: 15 }] },
    ] },
    { id: "nc-q5", text: "Do you see any white/green crusty buildup on the battery terminals?", whyAsking: "Terminal corrosion is a very common cause of no-crank. It creates high resistance that prevents the hundreds of amps the starter needs.", options: [
      { label: "Yes, visible corrosion", value: "yes", effects: [{ hypothesisId: "nc-terminals", delta: 25 }] },
      { label: "Terminals look clean", value: "clean", effects: [{ hypothesisId: "nc-terminals", delta: -15 }] },
      { label: "Can't see them / unsure", value: "unsure", effects: [] },
    ] },
    { id: "nc-q6", text: "Any recent electrical work, battery replacement, or underhood repairs?", whyAsking: "Recent work can leave a ground strap disconnected, a relay unplugged, or terminals not properly torqued.", options: [
      { label: "Yes, recent work done", value: "yes", effects: [{ hypothesisId: "nc-ground", delta: 15 }, { hypothesisId: "nc-relay", delta: 10 }, { hypothesisId: "nc-terminals", delta: 10 }] },
      { label: "No recent work", value: "no", effects: [] },
    ] },
  ],
  tests: [
    { id: "nc-t1", name: "Battery voltage at rest", purpose: "Determines if the battery has sufficient charge to crank the engine", tools: ["Multimeter"], procedure: "Set multimeter to DC volts. Measure across battery terminals with key off. Record voltage.", expectedGood: "12.4-12.7V indicates full charge", expectedBad: "Below 12.2V indicates significant discharge, below 11.8V likely bad cell", difficulty: "beginner", discriminates: ["nc-battery", "nc-terminals"], passEffects: [{ hypothesisId: "nc-battery", delta: -20 }], failEffects: [{ hypothesisId: "nc-battery", delta: 25 }] },
    { id: "nc-t2", name: "Voltage drop test on cables", purpose: "Finds high-resistance connections that steal voltage from the starter", tools: ["Multimeter"], procedure: "Connect multimeter across the positive battery post and starter B+ terminal. Have someone attempt to crank. Repeat on negative post to engine block.", expectedGood: "Less than 0.5V drop on positive side, less than 0.3V on ground side", expectedBad: "More than 0.5V drop means high resistance in that cable or connection", difficulty: "intermediate", discriminates: ["nc-ground", "nc-terminals"], passEffects: [{ hypothesisId: "nc-ground", delta: -20 }, { hypothesisId: "nc-terminals", delta: -15 }], failEffects: [{ hypothesisId: "nc-ground", delta: 25 }, { hypothesisId: "nc-terminals", delta: 20 }] },
    { id: "nc-t3", name: "Starter signal wire check", purpose: "Verifies the starter solenoid is receiving its trigger signal from the ignition switch/relay", tools: ["Test light or multimeter"], procedure: "Locate the small signal wire on the starter solenoid (S terminal). Connect test light between S terminal and ground. Have someone turn key to start.", expectedGood: "Test light illuminates during cranking attempt - signal is reaching starter", expectedBad: "No light - problem is upstream (relay, ignition switch, neutral safety switch, or wiring)", difficulty: "intermediate", discriminates: ["nc-relay", "nc-starter"], passEffects: [{ hypothesisId: "nc-relay", delta: -20 }, { hypothesisId: "nc-starter", delta: 15 }], failEffects: [{ hypothesisId: "nc-relay", delta: 25 }, { hypothesisId: "nc-starter", delta: -10 }] },
    { id: "nc-t4", name: "Manual engine rotation check", purpose: "Rules out mechanical engine lockup by confirming the crankshaft can rotate", tools: ["Breaker bar", "Correct socket for crank bolt"], procedure: "Place socket on crankshaft bolt. Attempt to rotate engine clockwise by hand. It should turn with moderate effort.", expectedGood: "Engine rotates smoothly with normal compression resistance", expectedBad: "Engine will not rotate or has a hard stop - possible hydro-lock or seized bearing", difficulty: "intermediate", discriminates: ["nc-lockup"], passEffects: [{ hypothesisId: "nc-lockup", delta: -30 }], failEffects: [{ hypothesisId: "nc-lockup", delta: 40 }] },
  ],
};

const noStart: CategoryDefinition = {
  id: "no-start",
  name: "Cranks, Won't Start",
  icon: "power",
  description: "Engine cranks normally but fails to fire and run",
  hypotheses: [
    { id: "ns-fuel", name: "No fuel delivery (pump, relay, or filter)", baseConfidence: 30, description: "The fuel pump is not priming, the pump relay has failed, or a clogged filter is restricting flow.", difficulty: "moderate", costRange: "$150-600", safetyLevel: "use-caution", toolLevel: "Fuel pressure gauge" },
    { id: "ns-spark", name: "No spark (coil, module, or crank sensor)", baseConfidence: 25, description: "Ignition system not producing spark. Often caused by a failed crankshaft position sensor, ignition module, or coil.", difficulty: "moderate", costRange: "$30-200", safetyLevel: "diy-safe", toolLevel: "Spark tester, multimeter" },
    { id: "ns-injector", name: "Injectors not pulsing", baseConfidence: 15, description: "The ECM is not sending injector pulse signals, typically from a sensor input failure or ECM issue.", difficulty: "moderate", costRange: "$50-300", safetyLevel: "diy-safe", toolLevel: "Noid light, scan tool" },
    { id: "ns-timing", name: "Timing chain/belt jumped or broken", baseConfidence: 12, description: "The timing belt or chain has skipped teeth or broken, causing valves and pistons to be out of sync.", difficulty: "hard", costRange: "$400-1500", safetyLevel: "professional", toolLevel: "Timing marks inspection" },
    { id: "ns-security", name: "Immobilizer / security lockout", baseConfidence: 10, description: "The vehicle's anti-theft system does not recognize the key and is disabling fuel or spark.", difficulty: "moderate", costRange: "$0-300", safetyLevel: "diy-safe", toolLevel: "Scan tool" },
    { id: "ns-flooded", name: "Engine flooded (excess fuel)", baseConfidence: 8, description: "Too much fuel has washed the spark plugs, preventing ignition. Common after repeated short crank attempts.", difficulty: "easy", costRange: "$0-30", safetyLevel: "diy-safe", toolLevel: "Spark plug socket" },
  ],
  questions: [
    { id: "ns-q1", text: "Does the engine crank at normal speed, or does it spin unusually fast?", whyAsking: "An engine with no compression (broken timing belt on interference engine) will spin faster than normal because there is no cylinder resistance.", options: [
      { label: "Normal cranking speed", value: "normal", effects: [{ hypothesisId: "ns-timing", delta: -10 }] },
      { label: "Spins faster than usual", value: "fast", effects: [{ hypothesisId: "ns-timing", delta: 25 }] },
      { label: "Not sure", value: "unsure", effects: [] },
    ] },
    { id: "ns-q2", text: "Do you hear the fuel pump prime when you turn the key to ON (a brief whir from the rear)?", whyAsking: "The fuel pump should run for 2-3 seconds when the key first turns on. No sound usually means the pump or its circuit has failed.", options: [
      { label: "Yes, I hear the pump", value: "yes", effects: [{ hypothesisId: "ns-fuel", delta: -15 }] },
      { label: "No pump sound", value: "no", effects: [{ hypothesisId: "ns-fuel", delta: 25 }] },
      { label: "Can't tell", value: "unsure", effects: [] },
    ] },
    { id: "ns-q3", text: "Do you smell raw fuel when cranking?", whyAsking: "Fuel smell means the injectors are delivering fuel. If you smell gas but it won't start, the problem is likely ignition, not fuel.", options: [
      { label: "Yes, strong fuel smell", value: "yes", effects: [{ hypothesisId: "ns-fuel", delta: -20 }, { hypothesisId: "ns-spark", delta: 15 }, { hypothesisId: "ns-flooded", delta: 20 }] },
      { label: "No fuel smell at all", value: "no", effects: [{ hypothesisId: "ns-fuel", delta: 15 }, { hypothesisId: "ns-injector", delta: 10 }] },
    ] },
    { id: "ns-q4", text: "Is the security / immobilizer light flashing on the dashboard?", whyAsking: "A flashing security light usually means the immobilizer has locked out the fuel and/or spark system because it does not recognize the key.", options: [
      { label: "Yes, security light flashing", value: "yes", effects: [{ hypothesisId: "ns-security", delta: 30 }, { hypothesisId: "ns-fuel", delta: -10 }, { hypothesisId: "ns-spark", delta: -10 }] },
      { label: "No, not flashing", value: "no", effects: [{ hypothesisId: "ns-security", delta: -15 }] },
      { label: "Not sure / no such light", value: "unsure", effects: [] },
    ] },
    { id: "ns-q5", text: "Did this happen suddenly or has it been getting harder to start over time?", whyAsking: "Gradual worsening suggests wear (fuel pump weakening, sensor drift). Sudden failure points to a component that broke outright.", options: [
      { label: "Completely sudden, ran fine yesterday", value: "sudden", effects: [{ hypothesisId: "ns-timing", delta: 10 }, { hypothesisId: "ns-fuel", delta: 5 }, { hypothesisId: "ns-security", delta: 5 }] },
      { label: "Has been getting harder to start", value: "gradual", effects: [{ hypothesisId: "ns-fuel", delta: 10 }, { hypothesisId: "ns-spark", delta: 10 }] },
    ] },
    { id: "ns-q6", text: "Any stored diagnostic trouble codes (DTCs)?", whyAsking: "Codes like P0335 (crank sensor), P0230 (fuel pump circuit), or P1260 (theft detected) can immediately point to the root cause.", options: [
      { label: "Yes, crank or cam sensor code", value: "ckp-code", effects: [{ hypothesisId: "ns-spark", delta: 20 }, { hypothesisId: "ns-injector", delta: 10 }] },
      { label: "Yes, fuel system code", value: "fuel-code", effects: [{ hypothesisId: "ns-fuel", delta: 20 }] },
      { label: "Yes, security/immobilizer code", value: "security-code", effects: [{ hypothesisId: "ns-security", delta: 25 }] },
      { label: "No codes or haven't scanned", value: "none", effects: [] },
    ] },
  ],
  tests: [
    { id: "ns-t1", name: "Spark test", purpose: "Confirms whether the ignition system is producing spark at the plugs", tools: ["Inline spark tester or spare plug"], procedure: "Remove a spark plug wire or coil-on-plug connector. Attach spark tester. Ground tester to engine. Crank engine and observe for spark.", expectedGood: "Bright blue/white spark visible on each crank revolution", expectedBad: "No spark or weak orange spark - ignition system failure", difficulty: "beginner", discriminates: ["ns-spark"], passEffects: [{ hypothesisId: "ns-spark", delta: -25 }], failEffects: [{ hypothesisId: "ns-spark", delta: 30 }] },
    { id: "ns-t2", name: "Fuel pressure test", purpose: "Verifies the fuel pump is delivering adequate pressure to the fuel rail", tools: ["Fuel pressure gauge"], procedure: "Connect gauge to fuel rail test port (Schrader valve). Turn key to ON without cranking. Read pressure. Then crank and watch for pressure changes.", expectedGood: "35-65 PSI (varies by system) that holds steady with key on", expectedBad: "Zero PSI (dead pump), low PSI (weak pump or clogged filter), rapid drop (leaking injector or check valve)", difficulty: "intermediate", discriminates: ["ns-fuel"], passEffects: [{ hypothesisId: "ns-fuel", delta: -25 }], failEffects: [{ hypothesisId: "ns-fuel", delta: 30 }] },
    { id: "ns-t3", name: "Injector pulse check with noid light", purpose: "Confirms the ECM is sending electrical pulses to fire the injectors", tools: ["Noid light set"], procedure: "Disconnect one fuel injector connector. Plug in noid light. Crank the engine. Light should flash rapidly during cranking.", expectedGood: "Noid light flashes on each injector event - ECM is commanding fuel", expectedBad: "No flashing - ECM is not pulsing injectors (check CKP sensor, ECM power, immobilizer)", difficulty: "intermediate", discriminates: ["ns-injector", "ns-security"], passEffects: [{ hypothesisId: "ns-injector", delta: -20 }, { hypothesisId: "ns-security", delta: -10 }], failEffects: [{ hypothesisId: "ns-injector", delta: 20 }, { hypothesisId: "ns-security", delta: 10 }] },
    { id: "ns-t4", name: "Compression test", purpose: "Verifies cylinders are sealing properly and timing components are intact", tools: ["Compression tester", "Spark plug socket"], procedure: "Remove all spark plugs. Disable fuel and ignition. Thread compression gauge into cylinder 1. Crank 5-7 revolutions. Record PSI. Repeat all cylinders.", expectedGood: "120-180 PSI per cylinder, all within 10% of each other", expectedBad: "Below 90 PSI or more than 20% variation - possible timing jump, head gasket, or ring/valve failure", difficulty: "intermediate", discriminates: ["ns-timing"], passEffects: [{ hypothesisId: "ns-timing", delta: -25 }], failEffects: [{ hypothesisId: "ns-timing", delta: 30 }] },
  ],
};

const overheating: CategoryDefinition = {
  id: "overheating",
  name: "Overheating",
  icon: "thermometer",
  description: "Engine temperature climbing above normal operating range",
  hypotheses: [
    { id: "oh-coolant", name: "Low coolant from external leak", baseConfidence: 30, description: "Coolant is escaping through a hose, radiator, water pump weep hole, or gasket. The system cannot maintain pressure and temperature.", difficulty: "easy", costRange: "$0-200", safetyLevel: "use-caution", toolLevel: "Pressure tester" },
    { id: "oh-thermostat", name: "Stuck-closed thermostat", baseConfidence: 25, description: "The thermostat is not opening at its rated temperature, blocking coolant flow to the radiator.", difficulty: "easy", costRange: "$15-40", safetyLevel: "diy-safe", toolLevel: "Basic hand tools" },
    { id: "oh-fan", name: "Cooling fan not operating", baseConfidence: 15, description: "The electric radiator fan is not turning on at temperature, or the fan clutch on a mechanical fan is slipping.", difficulty: "easy", costRange: "$50-250", safetyLevel: "use-caution", toolLevel: "Multimeter" },
    { id: "oh-pump", name: "Water pump failure", baseConfidence: 12, description: "Impeller is corroded/broken or the pump bearing has failed, preventing coolant circulation.", difficulty: "moderate", costRange: "$150-400", safetyLevel: "diy-safe", toolLevel: "Socket set, drain pan" },
    { id: "oh-radiator", name: "Radiator internal blockage", baseConfidence: 10, description: "Mineral deposits or debris have clogged radiator passages, reducing heat exchange capacity.", difficulty: "moderate", costRange: "$200-500", safetyLevel: "diy-safe", toolLevel: "Infrared thermometer" },
    { id: "oh-headgasket", name: "Head gasket breach", baseConfidence: 8, description: "Combustion gases are entering the cooling system, creating pressure and displacing coolant.", difficulty: "hard", costRange: "$800-2000", safetyLevel: "professional", toolLevel: "Block test kit, pressure tester" },
  ],
  questions: [
    { id: "oh-q1", text: "Does the engine overheat at highway speed, at idle, or both?", whyAsking: "Highway-only overheating usually points to a thermostat or water pump. Idle-only points to the cooling fan. Both suggests a major restriction or head gasket.", options: [
      { label: "Only at highway speed", value: "highway", effects: [{ hypothesisId: "oh-thermostat", delta: 15 }, { hypothesisId: "oh-pump", delta: 10 }, { hypothesisId: "oh-fan", delta: -15 }] },
      { label: "Only at idle or slow driving", value: "idle", effects: [{ hypothesisId: "oh-fan", delta: 25 }, { hypothesisId: "oh-thermostat", delta: -10 }] },
      { label: "Both highway and idle", value: "both", effects: [{ hypothesisId: "oh-headgasket", delta: 15 }, { hypothesisId: "oh-coolant", delta: 10 }, { hypothesisId: "oh-radiator", delta: 10 }] },
    ] },
    { id: "oh-q2", text: "Is coolant level dropping over time? Any visible puddles?", whyAsking: "External leaks cause visible coolant loss. If the level drops but there is no visible leak, coolant may be entering the combustion chambers (head gasket) or leaking only under pressure.", options: [
      { label: "Yes, visible leak or puddle", value: "visible-leak", effects: [{ hypothesisId: "oh-coolant", delta: 25 }, { hypothesisId: "oh-headgasket", delta: -10 }] },
      { label: "Level drops but no visible leak", value: "internal-loss", effects: [{ hypothesisId: "oh-headgasket", delta: 25 }, { hypothesisId: "oh-coolant", delta: -10 }] },
      { label: "Coolant level is fine", value: "full", effects: [{ hypothesisId: "oh-coolant", delta: -20 }, { hypothesisId: "oh-thermostat", delta: 10 }, { hypothesisId: "oh-fan", delta: 10 }] },
    ] },
    { id: "oh-q3", text: "Does the heater blow hot air inside the cabin?", whyAsking: "The heater core uses the same coolant. If the heater blows cold when the engine is hot, coolant is not circulating (thermostat or water pump) or the system is too low on coolant.", options: [
      { label: "Yes, heater works fine", value: "hot", effects: [{ hypothesisId: "oh-thermostat", delta: -10 }, { hypothesisId: "oh-pump", delta: -10 }] },
      { label: "Heater blows cold or lukewarm", value: "cold", effects: [{ hypothesisId: "oh-thermostat", delta: 15 }, { hypothesisId: "oh-pump", delta: 15 }, { hypothesisId: "oh-coolant", delta: 10 }] },
    ] },
    { id: "oh-q4", text: "Do you see white smoke or sweet smell from the exhaust?", whyAsking: "White smoke and a sweet coolant smell from the tailpipe are hallmarks of coolant entering the combustion chamber through a failed head gasket.", options: [
      { label: "Yes, white smoke from exhaust", value: "yes", effects: [{ hypothesisId: "oh-headgasket", delta: 30 }] },
      { label: "No white smoke", value: "no", effects: [{ hypothesisId: "oh-headgasket", delta: -10 }] },
    ] },
    { id: "oh-q5", text: "Does the radiator fan spin when the engine is hot?", whyAsking: "The electric fan should turn on when coolant temperature reaches approximately 200-220F. A fan that never turns on will cause overheating at idle and in traffic.", options: [
      { label: "Yes, fan comes on", value: "yes", effects: [{ hypothesisId: "oh-fan", delta: -20 }] },
      { label: "Fan never comes on", value: "no", effects: [{ hypothesisId: "oh-fan", delta: 30 }] },
      { label: "Not sure / can't check safely", value: "unsure", effects: [] },
    ] },
  ],
  tests: [
    { id: "oh-t1", name: "Cooling system pressure test", purpose: "Finds external leaks by pressurizing the system and watching for pressure drop or visible seepage", tools: ["Cooling system pressure tester"], procedure: "Let engine cool completely. Remove radiator cap. Attach pressure tester and pump to rated cap pressure (usually 13-16 PSI). Hold for 15 minutes and inspect all hoses, connections, water pump weep hole, and radiator.", expectedGood: "Pressure holds steady with no visible leaks", expectedBad: "Pressure drops - trace leak location visually. No external leak found = internal (head gasket)", difficulty: "intermediate", discriminates: ["oh-coolant", "oh-headgasket"], passEffects: [{ hypothesisId: "oh-coolant", delta: -20 }], failEffects: [{ hypothesisId: "oh-coolant", delta: 25 }] },
    { id: "oh-t2", name: "Combustion gas (block) test", purpose: "Detects head gasket failure by testing for combustion gases in the coolant", tools: ["Block test kit (chemical test fluid)"], procedure: "Let engine cool, remove radiator cap. Fill block tester with blue fluid. Place over radiator opening. Run engine at 2000 RPM for 2-3 minutes. Watch fluid color.", expectedGood: "Fluid stays blue - no combustion gases in coolant", expectedBad: "Fluid turns yellow/green - combustion gases present, head gasket is breached", difficulty: "intermediate", discriminates: ["oh-headgasket"], passEffects: [{ hypothesisId: "oh-headgasket", delta: -25 }], failEffects: [{ hypothesisId: "oh-headgasket", delta: 35 }] },
    { id: "oh-t3", name: "Thermostat operation test", purpose: "Verifies the thermostat opens at the correct temperature", tools: ["Infrared thermometer"], procedure: "Start cold engine. Point IR thermometer at upper radiator hose. Watch temperature as engine warms. The hose should go from cold to hot suddenly around 195-210F when thermostat opens.", expectedGood: "Upper hose gets hot at the rated thermostat temperature", expectedBad: "Upper hose stays cold while engine overheats - thermostat stuck closed", difficulty: "beginner", discriminates: ["oh-thermostat"], passEffects: [{ hypothesisId: "oh-thermostat", delta: -25 }], failEffects: [{ hypothesisId: "oh-thermostat", delta: 30 }] },
  ],
};

const misfire: CategoryDefinition = {
  id: "misfire",
  name: "Misfire / Rough Idle",
  icon: "activity",
  description: "Engine running rough, shaking, or misfiring under load",
  hypotheses: [
    { id: "mf-plugs", name: "Worn or fouled spark plugs", baseConfidence: 30, description: "Spark plugs have exceeded service life, are oil-fouled, or have incorrect gap.", difficulty: "easy", costRange: "$20-60", safetyLevel: "diy-safe", toolLevel: "Spark plug socket, gap tool" },
    { id: "mf-coil", name: "Failed ignition coil", baseConfidence: 25, description: "One or more ignition coils have internal failure, producing weak or no spark on that cylinder.", difficulty: "easy", costRange: "$30-80 per coil", safetyLevel: "diy-safe", toolLevel: "Basic hand tools" },
    { id: "mf-vacuum", name: "Vacuum leak (intake gasket or hose)", baseConfidence: 18, description: "Unmetered air entering after the MAF sensor causes lean misfires, typically worse at idle.", difficulty: "moderate", costRange: "$20-200", safetyLevel: "diy-safe", toolLevel: "Propane/carb cleaner, smoke machine" },
    { id: "mf-injector", name: "Clogged or leaking fuel injector", baseConfidence: 12, description: "A dirty injector delivers insufficient fuel, or a leaking injector over-fuels one cylinder.", difficulty: "moderate", costRange: "$50-150 per injector", safetyLevel: "use-caution", toolLevel: "Scan tool with misfire data" },
    { id: "mf-compression", name: "Low compression on one cylinder", baseConfidence: 8, description: "Burned valve, broken ring, or head gasket leak on one cylinder causing consistent miss.", difficulty: "hard", costRange: "$500-2000", safetyLevel: "professional", toolLevel: "Compression tester" },
    { id: "mf-carbon", name: "Carbon buildup on intake valves (GDI)", baseConfidence: 7, description: "Direct-injection engines accumulate carbon on intake valves, disrupting airflow and causing misfire.", difficulty: "moderate", costRange: "$300-600", safetyLevel: "professional", toolLevel: "Walnut blaster or chemical clean" },
  ],
  questions: [
    { id: "mf-q1", text: "Is the misfire on a specific cylinder or random/multiple?", whyAsking: "A single-cylinder misfire (P0301-P0308) usually means a component on that cylinder failed (plug, coil, injector). Random misfires (P0300) suggest a systemic issue like vacuum leak or fuel pressure.", options: [
      { label: "One specific cylinder", value: "single", effects: [{ hypothesisId: "mf-coil", delta: 15 }, { hypothesisId: "mf-plugs", delta: 10 }, { hypothesisId: "mf-injector", delta: 10 }, { hypothesisId: "mf-vacuum", delta: -10 }] },
      { label: "Random or multiple cylinders", value: "random", effects: [{ hypothesisId: "mf-vacuum", delta: 20 }, { hypothesisId: "mf-plugs", delta: 10 }, { hypothesisId: "mf-coil", delta: -10 }] },
      { label: "No codes / not sure", value: "unsure", effects: [] },
    ] },
    { id: "mf-q2", text: "Is the misfire worse at cold start or after the engine is warm?", whyAsking: "Cold-start misfires suggest ignition weakness (plugs/coils struggle when cold). Warm-only misfires can indicate a coil breaking down with heat or injector issue.", options: [
      { label: "Worse when cold", value: "cold", effects: [{ hypothesisId: "mf-plugs", delta: 15 }, { hypothesisId: "mf-coil", delta: 10 }] },
      { label: "Worse when warm", value: "warm", effects: [{ hypothesisId: "mf-coil", delta: 15 }, { hypothesisId: "mf-injector", delta: 10 }] },
      { label: "Same cold and warm", value: "same", effects: [{ hypothesisId: "mf-vacuum", delta: 10 }, { hypothesisId: "mf-compression", delta: 10 }] },
    ] },
    { id: "mf-q3", text: "Is it worse at idle, under load (acceleration), or both?", whyAsking: "Idle-only roughness often points to vacuum leaks. Under-load misfire suggests ignition or fuel delivery can't keep up with demand.", options: [
      { label: "Mainly at idle", value: "idle", effects: [{ hypothesisId: "mf-vacuum", delta: 20 }, { hypothesisId: "mf-carbon", delta: 10 }] },
      { label: "Under acceleration or load", value: "load", effects: [{ hypothesisId: "mf-coil", delta: 15 }, { hypothesisId: "mf-plugs", delta: 10 }, { hypothesisId: "mf-injector", delta: 10 }] },
      { label: "Both idle and load", value: "both", effects: [{ hypothesisId: "mf-compression", delta: 15 }] },
    ] },
    { id: "mf-q4", text: "When were the spark plugs last replaced?", whyAsking: "Standard copper plugs last 30K miles, platinum 60K, iridium 80-100K. Plugs beyond service life are a common and cheap fix.", options: [
      { label: "Within recommended interval", value: "recent", effects: [{ hypothesisId: "mf-plugs", delta: -15 }] },
      { label: "Overdue or unknown", value: "overdue", effects: [{ hypothesisId: "mf-plugs", delta: 20 }] },
    ] },
    { id: "mf-q5", text: "Is this a direct-injection (GDI/TGDI) engine?", whyAsking: "Direct-injection engines are prone to carbon buildup on intake valves because fuel is sprayed directly into the cylinder, not across the valves.", options: [
      { label: "Yes, direct injection", value: "yes", effects: [{ hypothesisId: "mf-carbon", delta: 20 }] },
      { label: "No, port injection or unsure", value: "no", effects: [{ hypothesisId: "mf-carbon", delta: -10 }] },
    ] },
  ],
  tests: [
    { id: "mf-t1", name: "Coil swap test", purpose: "Determines if a specific coil is causing the misfire by moving it to another cylinder", tools: ["Basic hand tools"], procedure: "Note which cylinder is misfiring (e.g., cyl 3). Swap that coil with an adjacent cylinder (e.g., cyl 1). Clear codes. Run engine and see if the misfire follows the coil.", expectedGood: "Misfire stays on original cylinder - coil is not the problem", expectedBad: "Misfire moves to the new cylinder - that coil is bad, replace it", difficulty: "beginner", discriminates: ["mf-coil"], passEffects: [{ hypothesisId: "mf-coil", delta: -20 }], failEffects: [{ hypothesisId: "mf-coil", delta: 30 }] },
    { id: "mf-t2", name: "Vacuum leak smoke test", purpose: "Finds unmetered air leaks in the intake system", tools: ["Smoke machine or propane torch"], procedure: "With engine idling, introduce smoke into the intake or carefully pass propane around intake gaskets, vacuum hoses, and PCV connections. RPM change with propane = leak found.", expectedGood: "No RPM change, no smoke escaping - intake is sealed", expectedBad: "RPM rises at a specific location or smoke visible - leak found at that point", difficulty: "intermediate", discriminates: ["mf-vacuum"], passEffects: [{ hypothesisId: "mf-vacuum", delta: -20 }], failEffects: [{ hypothesisId: "mf-vacuum", delta: 25 }] },
    { id: "mf-t3", name: "Compression test", purpose: "Checks cylinder sealing to find mechanical failures", tools: ["Compression tester", "Spark plug socket"], procedure: "Warm engine to operating temp. Remove all spark plugs. Disable fuel/ignition. Thread gauge into each cylinder, crank 5-7 times, record peak PSI.", expectedGood: "All cylinders 120-180 PSI, within 10% of each other", expectedBad: "One cylinder significantly low - burnt valve, broken ring, or head gasket leak on that cylinder", difficulty: "intermediate", discriminates: ["mf-compression"], passEffects: [{ hypothesisId: "mf-compression", delta: -25 }], failEffects: [{ hypothesisId: "mf-compression", delta: 30 }] },
  ],
};

const chargingSystem: CategoryDefinition = {
  id: "charging-system",
  name: "Charging System",
  icon: "battery-charging",
  description: "Battery light on, battery keeps dying, dimming lights",
  hypotheses: [
    { id: "cs-alternator", name: "Failed alternator", baseConfidence: 35, description: "The alternator is no longer producing sufficient voltage or current to charge the battery and run accessories.", difficulty: "moderate", costRange: "$200-500", safetyLevel: "diy-safe", toolLevel: "Multimeter, socket set" },
    { id: "cs-belt", name: "Serpentine belt slipping or broken", baseConfidence: 20, description: "The belt that drives the alternator is loose, glazed, or broken, so the alternator cannot spin at the correct speed.", difficulty: "easy", costRange: "$25-60", safetyLevel: "diy-safe", toolLevel: "Belt pry bar, wrench" },
    { id: "cs-battery", name: "Battery failing to hold charge", baseConfidence: 20, description: "The battery accepts charge from the alternator but cannot retain it due to internal sulfation or a dead cell.", difficulty: "easy", costRange: "$100-200", safetyLevel: "diy-safe", toolLevel: "Load tester, multimeter" },
    { id: "cs-wiring", name: "Charging circuit wiring issue", baseConfidence: 15, description: "Corroded or damaged wiring between alternator, battery, and ECM prevents proper charging or voltage sensing.", difficulty: "moderate", costRange: "$30-150", safetyLevel: "diy-safe", toolLevel: "Multimeter, wiring diagram" },
    { id: "cs-regulator", name: "Voltage regulator failure", baseConfidence: 10, description: "The regulator (internal to most modern alternators) is over- or under-charging. Over-charging boils battery; under-charging drains it.", difficulty: "moderate", costRange: "$50-150", safetyLevel: "diy-safe", toolLevel: "Multimeter" },
  ],
  questions: [
    { id: "cs-q1", text: "Is the battery/charging warning light illuminated on the dash?", whyAsking: "The dash light is triggered when the ECM detects alternator output has dropped below threshold. A lit warning light strongly suggests alternator or belt failure.", options: [
      { label: "Yes, light is on", value: "yes", effects: [{ hypothesisId: "cs-alternator", delta: 15 }, { hypothesisId: "cs-belt", delta: 10 }] },
      { label: "No light, but battery keeps dying", value: "no-light", effects: [{ hypothesisId: "cs-battery", delta: 15 }, { hypothesisId: "cs-wiring", delta: 10 }, { hypothesisId: "cs-alternator", delta: -5 }] },
    ] },
    { id: "cs-q2", text: "Do you hear a squealing noise from the engine, especially at startup or under electrical load?", whyAsking: "A squealing serpentine belt is slipping on the alternator pulley and cannot spin it fast enough to charge properly.", options: [
      { label: "Yes, belt squeal", value: "yes", effects: [{ hypothesisId: "cs-belt", delta: 25 }] },
      { label: "No unusual noise", value: "no", effects: [{ hypothesisId: "cs-belt", delta: -10 }] },
    ] },
    { id: "cs-q3", text: "How old is the battery?", whyAsking: "Batteries have a finite life. A battery over 4-5 years may accept charge but cannot hold it long enough to start the vehicle after sitting.", options: [
      { label: "Less than 3 years", value: "new", effects: [{ hypothesisId: "cs-battery", delta: -15 }] },
      { label: "3-5 years", value: "mid", effects: [{ hypothesisId: "cs-battery", delta: 5 }] },
      { label: "Over 5 years or unknown", value: "old", effects: [{ hypothesisId: "cs-battery", delta: 20 }] },
    ] },
    { id: "cs-q4", text: "Do headlights dim noticeably at idle but brighten when you rev the engine?", whyAsking: "This behavior indicates the alternator is producing some output but not enough at idle RPM. Often a worn alternator or undersize belt.", options: [
      { label: "Yes, dim at idle, brighter at RPM", value: "yes", effects: [{ hypothesisId: "cs-alternator", delta: 15 }, { hypothesisId: "cs-belt", delta: 10 }] },
      { label: "Lights are always dim", value: "always-dim", effects: [{ hypothesisId: "cs-wiring", delta: 15 }] },
      { label: "Lights seem normal", value: "normal", effects: [{ hypothesisId: "cs-alternator", delta: -5 }] },
    ] },
    { id: "cs-q5", text: "Has the alternator or battery been replaced recently?", whyAsking: "A recently replaced alternator could be defective or incorrectly wired. A new battery that keeps dying points to a charging problem rather than the battery itself.", options: [
      { label: "New alternator installed", value: "new-alt", effects: [{ hypothesisId: "cs-wiring", delta: 15 }, { hypothesisId: "cs-regulator", delta: 10 }, { hypothesisId: "cs-alternator", delta: -10 }] },
      { label: "New battery installed", value: "new-batt", effects: [{ hypothesisId: "cs-alternator", delta: 15 }, { hypothesisId: "cs-battery", delta: -20 }] },
      { label: "No recent replacements", value: "none", effects: [] },
    ] },
  ],
  tests: [
    { id: "cs-t1", name: "Charging voltage test", purpose: "Measures alternator output voltage with the engine running", tools: ["Multimeter"], procedure: "Start engine. Set multimeter to DC volts. Measure across battery terminals. Rev to 2000 RPM. Turn on headlights, blower, rear defog.", expectedGood: "13.8-14.5V at idle and under load", expectedBad: "Below 13.5V (undercharging) or above 15V (overcharging)", difficulty: "beginner", discriminates: ["cs-alternator", "cs-regulator"], passEffects: [{ hypothesisId: "cs-alternator", delta: -20 }, { hypothesisId: "cs-regulator", delta: -15 }], failEffects: [{ hypothesisId: "cs-alternator", delta: 25 }, { hypothesisId: "cs-regulator", delta: 15 }] },
    { id: "cs-t2", name: "Belt condition and tension check", purpose: "Verifies the serpentine belt is in good condition and properly tensioned", tools: ["Flashlight"], procedure: "Inspect belt for cracks, glazing, fraying, or chunks missing. Check tensioner arm position against indicator marks. Try to twist belt - should not rotate more than 90 degrees.", expectedGood: "Belt in good condition, tensioner in range, no excess play", expectedBad: "Visible cracks/glazing, tensioner maxed out, excessive slack", difficulty: "beginner", discriminates: ["cs-belt"], passEffects: [{ hypothesisId: "cs-belt", delta: -20 }], failEffects: [{ hypothesisId: "cs-belt", delta: 25 }] },
    { id: "cs-t3", name: "Battery load test", purpose: "Determines if the battery can hold voltage under starter-equivalent load", tools: ["Battery load tester or carbon pile"], procedure: "Fully charge battery first. Apply load equal to half the CCA rating for 15 seconds. Watch voltage under load.", expectedGood: "Voltage stays above 9.6V under load at 70F", expectedBad: "Voltage drops below 9.6V - battery has insufficient capacity", difficulty: "intermediate", discriminates: ["cs-battery"], passEffects: [{ hypothesisId: "cs-battery", delta: -20 }], failEffects: [{ hypothesisId: "cs-battery", delta: 25 }] },
  ],
};

const brakeNoise: CategoryDefinition = {
  id: "brake-noise",
  name: "Brake Noise / Pulsation",
  icon: "disc",
  description: "Squealing, grinding, vibration, or pulsation when braking",
  hypotheses: [
    { id: "bn-pads", name: "Worn brake pads", baseConfidence: 35, description: "Pads have worn past the minimum thickness. Wear indicators are contacting the rotor or metal backing plate is exposed.", difficulty: "easy", costRange: "$30-80 per axle", safetyLevel: "diy-safe", toolLevel: "Jack, lug wrench, C-clamp" },
    { id: "bn-rotors", name: "Warped or scored rotors", baseConfidence: 25, description: "Rotors have developed lateral runout (warping) or deep grooves, causing pulsation and/or noise.", difficulty: "easy", costRange: "$40-100 each", safetyLevel: "diy-safe", toolLevel: "Micrometer, dial indicator" },
    { id: "bn-caliper", name: "Sticking caliper or slide pins", baseConfidence: 18, description: "A caliper piston or slide pin is seized, causing uneven pad wear, dragging, and overheating.", difficulty: "moderate", costRange: "$60-200", safetyLevel: "use-caution", toolLevel: "Socket set, brake grease" },
    { id: "bn-hardware", name: "Missing or worn anti-rattle hardware/shims", baseConfidence: 12, description: "Brake pad clips, shims, or anti-rattle springs are missing or damaged, allowing pads to vibrate.", difficulty: "easy", costRange: "$10-30", safetyLevel: "diy-safe", toolLevel: "Basic hand tools" },
    { id: "bn-bearing", name: "Worn wheel bearing", baseConfidence: 10, description: "A failing wheel bearing creates a rumbling or grinding noise that can mimic brake noise but varies with speed, not pedal pressure.", difficulty: "moderate", costRange: "$150-400", safetyLevel: "use-caution", toolLevel: "Jack, socket set" },
  ],
  questions: [
    { id: "bn-q1", text: "What type of noise are you hearing?", whyAsking: "High-pitched squealing usually means pad wear indicators. Grinding means metal-on-metal. Clunking suggests loose hardware. Rumbling may be a bearing.", options: [
      { label: "High-pitched squeal", value: "squeal", effects: [{ hypothesisId: "bn-pads", delta: 20 }, { hypothesisId: "bn-hardware", delta: 10 }] },
      { label: "Deep grinding", value: "grinding", effects: [{ hypothesisId: "bn-pads", delta: 25 }, { hypothesisId: "bn-rotors", delta: 15 }] },
      { label: "Pulsation in pedal", value: "pulsation", effects: [{ hypothesisId: "bn-rotors", delta: 25 }, { hypothesisId: "bn-caliper", delta: 10 }] },
      { label: "Constant hum or rumble", value: "rumble", effects: [{ hypothesisId: "bn-bearing", delta: 25 }, { hypothesisId: "bn-caliper", delta: 10 }] },
    ] },
    { id: "bn-q2", text: "Does the noise only occur when you press the brake pedal?", whyAsking: "Noise only while braking points to pads/rotors. Noise that happens regardless of braking suggests a dragging caliper or wheel bearing.", options: [
      { label: "Only when braking", value: "braking-only", effects: [{ hypothesisId: "bn-pads", delta: 10 }, { hypothesisId: "bn-rotors", delta: 10 }, { hypothesisId: "bn-bearing", delta: -15 }] },
      { label: "Even without braking", value: "constant", effects: [{ hypothesisId: "bn-caliper", delta: 20 }, { hypothesisId: "bn-bearing", delta: 20 }, { hypothesisId: "bn-pads", delta: -10 }] },
    ] },
    { id: "bn-q3", text: "Is it coming from the front, rear, or one specific corner?", whyAsking: "Identifying which corner helps isolate the component. One-corner issues suggest caliper or bearing on that side.", options: [
      { label: "Front only", value: "front", effects: [{ hypothesisId: "bn-pads", delta: 5 }] },
      { label: "Rear only", value: "rear", effects: [{ hypothesisId: "bn-pads", delta: 5 }] },
      { label: "One specific corner", value: "one-corner", effects: [{ hypothesisId: "bn-caliper", delta: 15 }, { hypothesisId: "bn-bearing", delta: 10 }] },
      { label: "Not sure", value: "unsure", effects: [] },
    ] },
    { id: "bn-q4", text: "When was the last brake service?", whyAsking: "Brakes are wear items with known service intervals. Pads that have not been replaced in 40-60K miles are likely worn.", options: [
      { label: "Recently (less than 20K miles)", value: "recent", effects: [{ hypothesisId: "bn-pads", delta: -15 }, { hypothesisId: "bn-hardware", delta: 10 }] },
      { label: "A while ago or unknown", value: "old", effects: [{ hypothesisId: "bn-pads", delta: 15 }] },
    ] },
    { id: "bn-q5", text: "Do you feel the steering wheel vibrate when braking from highway speed?", whyAsking: "Steering wheel vibration during braking is a classic sign of warped front rotors. Pedal pulsation alone can be front or rear.", options: [
      { label: "Yes, steering wheel shakes", value: "yes", effects: [{ hypothesisId: "bn-rotors", delta: 20 }] },
      { label: "No steering wheel vibration", value: "no", effects: [{ hypothesisId: "bn-rotors", delta: -5 }] },
    ] },
  ],
  tests: [
    { id: "bn-t1", name: "Visual pad thickness inspection", purpose: "Determines remaining brake pad life by measuring pad material thickness", tools: ["Flashlight", "Ruler or caliper"], procedure: "Remove wheel. Measure pad thickness at thinnest point. Minimum safe thickness is 3mm (just over 1/8 inch). Check both inner and outer pads.", expectedGood: "Pads are 4mm+ thick with even wear", expectedBad: "Pads below 3mm, uneven wear, or metal showing", difficulty: "beginner", discriminates: ["bn-pads"], passEffects: [{ hypothesisId: "bn-pads", delta: -20 }], failEffects: [{ hypothesisId: "bn-pads", delta: 25 }] },
    { id: "bn-t2", name: "Rotor runout measurement", purpose: "Measures lateral runout (warping) to identify pulsation source", tools: ["Dial indicator", "Magnetic base"], procedure: "Mount dial indicator against rotor face. Rotate rotor one full turn. Record total indicator reading (TIR).", expectedGood: "Less than 0.002 inch (0.05mm) runout", expectedBad: "More than 0.003 inch indicates rotor warping causing pulsation", difficulty: "intermediate", discriminates: ["bn-rotors"], passEffects: [{ hypothesisId: "bn-rotors", delta: -20 }], failEffects: [{ hypothesisId: "bn-rotors", delta: 25 }] },
    { id: "bn-t3", name: "Caliper slide pin and piston check", purpose: "Verifies caliper slides freely and piston retracts properly", tools: ["C-clamp", "Brake grease"], procedure: "Remove caliper from bracket. Slide pins should pull out and push in smoothly. Piston should compress with steady C-clamp pressure. Check for torn dust boots.", expectedGood: "Pins slide freely, piston compresses smoothly, boots intact", expectedBad: "Pins seized, piston won't compress, or torn boots - caliper needs service or replacement", difficulty: "intermediate", discriminates: ["bn-caliper"], passEffects: [{ hypothesisId: "bn-caliper", delta: -20 }], failEffects: [{ hypothesisId: "bn-caliper", delta: 25 }] },
  ],
};

const frontEndClunk: CategoryDefinition = {
  id: "front-end-clunk",
  name: "Front-End Clunk / Noise",
  icon: "truck",
  description: "Clunking, popping, or knocking from front suspension",
  hypotheses: [
    { id: "fe-endlinks", name: "Worn sway bar end links", baseConfidence: 30, description: "End link ball joints wear out, allowing the sway bar to knock against the control arms over bumps. Most common front-end clunk.", difficulty: "easy", costRange: "$30-70 per pair", safetyLevel: "diy-safe", toolLevel: "Wrench set" },
    { id: "fe-balljoint", name: "Worn ball joints", baseConfidence: 22, description: "Ball joints connect the control arm to the steering knuckle. Excessive play causes clunking and can affect alignment.", difficulty: "moderate", costRange: "$80-200 per side", safetyLevel: "use-caution", toolLevel: "Jack, pry bar" },
    { id: "fe-tierod", name: "Loose tie rod ends", baseConfidence: 15, description: "Tie rod ends connect the steering rack to the knuckle. Play in these causes clunking during turns and over bumps.", difficulty: "moderate", costRange: "$30-80 per side", safetyLevel: "use-caution", toolLevel: "Wrench, pry bar" },
    { id: "fe-strut", name: "Failed strut mount or bearing", baseConfidence: 15, description: "The upper strut mount or bearing plate has deteriorated, causing a clunk or pop especially when turning the steering wheel.", difficulty: "moderate", costRange: "$50-120 per side", safetyLevel: "use-caution", toolLevel: "Spring compressor (professional)" },
    { id: "fe-bushings", name: "Worn control arm bushings", baseConfidence: 10, description: "Rubber bushings in the control arms have cracked or deformed, allowing movement and noise under load.", difficulty: "moderate", costRange: "$40-150 per arm", safetyLevel: "diy-safe", toolLevel: "Bushing press or shop press" },
    { id: "fe-loose", name: "Loose heat shield or splash guard", baseConfidence: 8, description: "A loose exhaust heat shield or fender splash guard can rattle and sound like a suspension clunk.", difficulty: "easy", costRange: "$0-30", safetyLevel: "diy-safe", toolLevel: "Zip ties, clamps" },
  ],
  questions: [
    { id: "fe-q1", text: "When does the clunk happen?", whyAsking: "Over bumps points to sway bar end links, ball joints, or bushings. During turning suggests strut mounts or tie rods. Constant at speed may be a loose component.", options: [
      { label: "Over bumps or rough roads", value: "bumps", effects: [{ hypothesisId: "fe-endlinks", delta: 15 }, { hypothesisId: "fe-balljoint", delta: 10 }, { hypothesisId: "fe-bushings", delta: 10 }] },
      { label: "When turning the steering wheel", value: "turning", effects: [{ hypothesisId: "fe-strut", delta: 20 }, { hypothesisId: "fe-tierod", delta: 15 }] },
      { label: "Both bumps and turning", value: "both", effects: [{ hypothesisId: "fe-balljoint", delta: 15 }, { hypothesisId: "fe-tierod", delta: 10 }] },
      { label: "Low-speed rattling", value: "rattle", effects: [{ hypothesisId: "fe-loose", delta: 20 }] },
    ] },
    { id: "fe-q2", text: "Is the noise from one side or both sides?", whyAsking: "One-side noise narrows the search to that corner. Both-sides simultaneously is less common and may suggest a center component like the sway bar itself.", options: [
      { label: "One side only", value: "one-side", effects: [{ hypothesisId: "fe-balljoint", delta: 5 }, { hypothesisId: "fe-tierod", delta: 5 }] },
      { label: "Both sides", value: "both", effects: [{ hypothesisId: "fe-endlinks", delta: 10 }, { hypothesisId: "fe-bushings", delta: 10 }] },
      { label: "Hard to tell", value: "unsure", effects: [] },
    ] },
    { id: "fe-q3", text: "Does the clunk only happen at low speed or also at highway speed?", whyAsking: "Low-speed-only clunks are usually suspension joints. Noises at highway speed may involve wheel bearings or loose body parts.", options: [
      { label: "Low speed only", value: "low", effects: [{ hypothesisId: "fe-endlinks", delta: 10 }, { hypothesisId: "fe-balljoint", delta: 10 }] },
      { label: "All speeds", value: "all", effects: [{ hypothesisId: "fe-bushings", delta: 10 }] },
      { label: "Highway speed only", value: "highway", effects: [{ hypothesisId: "fe-loose", delta: 15 }] },
    ] },
    { id: "fe-q4", text: "Has the vehicle had a recent alignment, or is tire wear uneven?", whyAsking: "Uneven tire wear can indicate worn ball joints or tie rods that have allowed alignment to shift. Recent alignment issues could indicate failed components.", options: [
      { label: "Uneven tire wear noticed", value: "uneven", effects: [{ hypothesisId: "fe-balljoint", delta: 15 }, { hypothesisId: "fe-tierod", delta: 15 }] },
      { label: "Tires wearing evenly", value: "even", effects: [{ hypothesisId: "fe-balljoint", delta: -5 }, { hypothesisId: "fe-tierod", delta: -5 }] },
    ] },
    { id: "fe-q5", text: "Can you feel looseness or play in the steering wheel?", whyAsking: "Steering play (dead zone when turning) strongly suggests worn tie rod ends or steering rack bushings.", options: [
      { label: "Yes, there is play", value: "yes", effects: [{ hypothesisId: "fe-tierod", delta: 20 }] },
      { label: "Steering feels tight", value: "no", effects: [{ hypothesisId: "fe-tierod", delta: -10 }] },
    ] },
  ],
  tests: [
    { id: "fe-t1", name: "Sway bar end link check", purpose: "Tests for play in the sway bar end link ball joints", tools: ["Pry bar or large screwdriver"], procedure: "Vehicle on ground. Grab end link by hand and try to rotate/push it. With vehicle raised, pry between sway bar and control arm. Any clunking or visible play = worn.", expectedGood: "No play or movement in end link joints", expectedBad: "Visible play, loose ball joint, or audible clunk when pried", difficulty: "beginner", discriminates: ["fe-endlinks"], passEffects: [{ hypothesisId: "fe-endlinks", delta: -20 }], failEffects: [{ hypothesisId: "fe-endlinks", delta: 25 }] },
    { id: "fe-t2", name: "Ball joint play test", purpose: "Checks for excessive play in lower and upper ball joints", tools: ["Jack", "Jack stands", "Pry bar"], procedure: "Raise vehicle so tire is off ground. Grip tire at 12 and 6 o'clock and rock it. Watch for play at the ball joint. Pry under the tire upward with a bar and look for movement at the joint.", expectedGood: "No perceptible play at the ball joint", expectedBad: "Visible movement or clunking at the ball joint - replacement needed", difficulty: "intermediate", discriminates: ["fe-balljoint"], passEffects: [{ hypothesisId: "fe-balljoint", delta: -20 }], failEffects: [{ hypothesisId: "fe-balljoint", delta: 25 }] },
    { id: "fe-t3", name: "Dry park test for tie rods", purpose: "Checks tie rod ends for play while the steering is rocked", tools: ["Assistant to rock steering wheel"], procedure: "Vehicle on ground, engine off. Have assistant rock the steering wheel slightly left-right while you watch the tie rod ends. Look for any movement or play at the ball joints.", expectedGood: "Tie rod moves in sync with the steering link, no play at the joint", expectedBad: "Visible play or delayed movement at the tie rod end ball joint", difficulty: "beginner", discriminates: ["fe-tierod"], passEffects: [{ hypothesisId: "fe-tierod", delta: -20 }], failEffects: [{ hypothesisId: "fe-tierod", delta: 25 }] },
  ],
};

const parasiticDrain: CategoryDefinition = {
  id: "parasitic-drain",
  name: "Parasitic Battery Drain",
  icon: "zap-off",
  description: "Battery dies overnight or after sitting a few days",
  hypotheses: [
    { id: "pd-aftermarket", name: "Aftermarket accessory drawing power", baseConfidence: 28, description: "Aftermarket stereos, amplifiers, dash cams, remote starters, or alarm systems often have always-on circuits that drain the battery.", difficulty: "easy", costRange: "$0-100", safetyLevel: "diy-safe", toolLevel: "Multimeter" },
    { id: "pd-module", name: "Control module not entering sleep mode", baseConfidence: 25, description: "A body control module, infotainment, or other computer is staying awake instead of entering its low-power sleep mode after the vehicle is shut off.", difficulty: "moderate", costRange: "$0-300", safetyLevel: "diy-safe", toolLevel: "Multimeter, scan tool" },
    { id: "pd-light", name: "Interior or trunk light staying on", baseConfidence: 18, description: "A dome light, glove box light, or trunk light is staying on due to a bad switch or misaligned door/lid.", difficulty: "easy", costRange: "$0-20", safetyLevel: "diy-safe", toolLevel: "None" },
    { id: "pd-relay", name: "Relay stuck in closed position", baseConfidence: 15, description: "A relay (fuel pump, blower motor, etc.) has welded contacts and keeps its circuit powered even when the vehicle is off.", difficulty: "moderate", costRange: "$10-40", safetyLevel: "diy-safe", toolLevel: "Multimeter" },
    { id: "pd-alternator", name: "Alternator diode leakage", baseConfidence: 14, description: "A failed diode in the alternator allows current to flow backwards from the battery through the alternator windings.", difficulty: "moderate", costRange: "$200-500", safetyLevel: "diy-safe", toolLevel: "Multimeter" },
  ],
  questions: [
    { id: "pd-q1", text: "How long does it take for the battery to go dead?", whyAsking: "Overnight drain suggests a large parasitic draw (over 300mA). A few days is moderate (50-300mA). A week+ may just be a weak battery.", options: [
      { label: "Overnight (12 hours or less)", value: "overnight", effects: [{ hypothesisId: "pd-light", delta: 10 }, { hypothesisId: "pd-aftermarket", delta: 10 }, { hypothesisId: "pd-relay", delta: 10 }] },
      { label: "After 2-3 days", value: "days", effects: [{ hypothesisId: "pd-module", delta: 10 }, { hypothesisId: "pd-alternator", delta: 10 }] },
      { label: "After a week or more", value: "week", effects: [{ hypothesisId: "pd-module", delta: 5 }] },
    ] },
    { id: "pd-q2", text: "Do you have any aftermarket accessories installed? (stereo, amp, dash cam, remote start, alarm)", whyAsking: "Aftermarket installations are the most common source of parasitic drain because they are often wired to always-on circuits.", options: [
      { label: "Yes, aftermarket accessories", value: "yes", effects: [{ hypothesisId: "pd-aftermarket", delta: 20 }] },
      { label: "No, everything is stock", value: "no", effects: [{ hypothesisId: "pd-aftermarket", delta: -15 }, { hypothesisId: "pd-module", delta: 10 }] },
    ] },
    { id: "pd-q3", text: "Have you noticed any lights staying on inside the vehicle after you lock it?", whyAsking: "A stuck interior light is one of the simplest causes of a dead battery and the easiest to fix.", options: [
      { label: "Yes, a light stays on", value: "yes", effects: [{ hypothesisId: "pd-light", delta: 30 }] },
      { label: "No, everything goes dark", value: "no", effects: [{ hypothesisId: "pd-light", delta: -15 }] },
      { label: "Haven't checked", value: "unsure", effects: [] },
    ] },
    { id: "pd-q4", text: "Any recent electrical work or new equipment installed?", whyAsking: "Recent work may have left a circuit hot, a relay energized, or a module in an error state that prevents sleep.", options: [
      { label: "Yes, recent electrical work", value: "yes", effects: [{ hypothesisId: "pd-aftermarket", delta: 10 }, { hypothesisId: "pd-relay", delta: 10 }, { hypothesisId: "pd-module", delta: 10 }] },
      { label: "No recent changes", value: "no", effects: [] },
    ] },
  ],
  tests: [
    { id: "pd-t1", name: "Parasitic draw measurement", purpose: "Measures the total current drain on the battery with the vehicle fully shut down", tools: ["Multimeter (10A DC range)", "Clamp-on DC ammeter (preferred)"], procedure: "Wait 30-45 minutes after locking vehicle for all modules to sleep. Set multimeter to DC amps. Connect in series between negative battery terminal and cable (or use clamp meter around negative cable). Read amperage.", expectedGood: "Less than 50mA (0.050A) total draw is normal", expectedBad: "Over 50mA indicates excessive parasitic drain - proceed to fuse pull test", difficulty: "beginner", discriminates: ["pd-aftermarket", "pd-module", "pd-light", "pd-relay", "pd-alternator"], passEffects: [], failEffects: [] },
    { id: "pd-t2", name: "Fuse pull test", purpose: "Isolates which circuit is causing the excessive draw by removing fuses one at a time", tools: ["Multimeter connected for draw measurement", "Fuse puller"], procedure: "With parasitic draw meter connected and showing excess draw, pull fuses one at a time from both the underhood and interior fuse boxes. When the draw drops to normal, you have found the offending circuit. Check the fuse box diagram to identify what is on that circuit.", expectedGood: "Offending circuit identified when draw drops - now you know where to look", expectedBad: "Draw persists through all fuses - suspect alternator diode or a circuit that bypasses the fuse box", difficulty: "intermediate", discriminates: ["pd-aftermarket", "pd-module", "pd-light", "pd-relay"], passEffects: [], failEffects: [{ hypothesisId: "pd-alternator", delta: 20 }] },
    { id: "pd-t3", name: "Alternator diode leakage test", purpose: "Checks if the alternator is draining the battery backward through a failed diode", tools: ["Multimeter"], procedure: "Disconnect the main charge wire from the alternator (large B+ terminal). Re-measure parasitic draw. If the excess draw disappears, the alternator has a leaking diode.", expectedGood: "Draw does not change when alternator is disconnected - alternator is fine", expectedBad: "Draw drops significantly - alternator has internal diode leakage", difficulty: "intermediate", discriminates: ["pd-alternator"], passEffects: [{ hypothesisId: "pd-alternator", delta: -25 }], failEffects: [{ hypothesisId: "pd-alternator", delta: 30 }] },
  ],
};

const acNotCold: CategoryDefinition = {
  id: "ac-not-cold",
  name: "AC Not Cold",
  icon: "wind",
  description: "Air conditioning blowing warm or not cooling sufficiently",
  hypotheses: [
    { id: "ac-refrigerant", name: "Low refrigerant from leak", baseConfidence: 35, description: "R-134a or R-1234yf has leaked from a hose, o-ring, condenser, or evaporator, reducing system cooling capacity.", difficulty: "moderate", costRange: "$100-400", safetyLevel: "use-caution", toolLevel: "AC gauge set, UV light" },
    { id: "ac-compressor", name: "Compressor failure or clutch not engaging", baseConfidence: 22, description: "The AC compressor has internal failure, or its electromagnetic clutch is not engaging due to low charge, blown fuse, or clutch failure.", difficulty: "hard", costRange: "$300-800", safetyLevel: "professional", toolLevel: "AC gauge set" },
    { id: "ac-condenser", name: "Blocked or damaged condenser", baseConfidence: 15, description: "The condenser in front of the radiator is blocked by debris, bent fins, or road damage, reducing heat rejection.", difficulty: "easy", costRange: "$150-400", safetyLevel: "diy-safe", toolLevel: "Garden hose, flashlight" },
    { id: "ac-blend", name: "Blend door actuator stuck on heat", baseConfidence: 13, description: "The blend door that mixes hot and cold air is stuck in the heat position due to a failed actuator motor.", difficulty: "moderate", costRange: "$50-200", safetyLevel: "diy-safe", toolLevel: "Trim tools" },
    { id: "ac-expansion", name: "Expansion valve or orifice tube clogged", baseConfidence: 8, description: "The metering device is restricted by debris or moisture, preventing proper refrigerant flow to the evaporator.", difficulty: "hard", costRange: "$100-300", safetyLevel: "professional", toolLevel: "AC gauge set" },
    { id: "ac-electrical", name: "Electrical issue (fuse, relay, pressure switch)", baseConfidence: 7, description: "A blown fuse, failed AC relay, or tripped pressure switch is preventing the compressor from activating.", difficulty: "easy", costRange: "$5-50", safetyLevel: "diy-safe", toolLevel: "Multimeter, fuse tester" },
  ],
  questions: [
    { id: "ac-q1", text: "Is the air slightly cool or completely warm/hot?", whyAsking: "Slightly cool means the system has some refrigerant and is partially working. Completely warm suggests a total loss of refrigerant, compressor failure, or blend door issue.", options: [
      { label: "Slightly cool but not cold", value: "warm-ish", effects: [{ hypothesisId: "ac-refrigerant", delta: 15 }, { hypothesisId: "ac-condenser", delta: 10 }] },
      { label: "Completely warm / hot air", value: "hot", effects: [{ hypothesisId: "ac-compressor", delta: 15 }, { hypothesisId: "ac-blend", delta: 15 }, { hypothesisId: "ac-electrical", delta: 10 }] },
    ] },
    { id: "ac-q2", text: "Do you hear the AC compressor clutch engage when you turn on the AC? (a click and slight RPM change)", whyAsking: "If the compressor never engages, the issue is upstream - low refrigerant (safety lockout), electrical, or clutch failure. If it engages, the compressor itself is working.", options: [
      { label: "Yes, compressor clicks on", value: "engages", effects: [{ hypothesisId: "ac-compressor", delta: -15 }, { hypothesisId: "ac-electrical", delta: -10 }, { hypothesisId: "ac-condenser", delta: 10 }] },
      { label: "No click, no RPM change", value: "no-engage", effects: [{ hypothesisId: "ac-refrigerant", delta: 15 }, { hypothesisId: "ac-compressor", delta: 15 }, { hypothesisId: "ac-electrical", delta: 15 }] },
      { label: "Compressor cycles on and off rapidly", value: "cycling", effects: [{ hypothesisId: "ac-refrigerant", delta: 25 }] },
    ] },
    { id: "ac-q3", text: "Is the temperature different on driver vs passenger side? (dual-zone systems)", whyAsking: "If one side is cold and the other is warm, it is almost certainly a blend door actuator on the warm side, not a refrigerant issue.", options: [
      { label: "Yes, one side colder than the other", value: "uneven", effects: [{ hypothesisId: "ac-blend", delta: 30 }, { hypothesisId: "ac-refrigerant", delta: -10 }] },
      { label: "Both sides equally warm", value: "even", effects: [{ hypothesisId: "ac-blend", delta: -10 }] },
      { label: "Single zone system", value: "single", effects: [] },
    ] },
    { id: "ac-q4", text: "Is the condenser (in front of the radiator) visibly dirty or blocked?", whyAsking: "A condenser clogged with bugs, leaves, or mud cannot reject heat. This is a free fix if you can clean it with a garden hose.", options: [
      { label: "Yes, visibly dirty or blocked", value: "dirty", effects: [{ hypothesisId: "ac-condenser", delta: 20 }] },
      { label: "Looks clean", value: "clean", effects: [{ hypothesisId: "ac-condenser", delta: -10 }] },
      { label: "Can't see it", value: "unsure", effects: [] },
    ] },
    { id: "ac-q5", text: "When was the AC last serviced or recharged?", whyAsking: "AC systems lose small amounts of refrigerant over time. A system that has not been serviced in 5+ years may simply be low.", options: [
      { label: "Recently (within 1-2 years)", value: "recent", effects: [{ hypothesisId: "ac-refrigerant", delta: -5 }, { hypothesisId: "ac-compressor", delta: 5 }] },
      { label: "Several years ago or never", value: "old", effects: [{ hypothesisId: "ac-refrigerant", delta: 15 }] },
    ] },
  ],
  tests: [
    { id: "ac-t1", name: "AC pressure check", purpose: "Reads high and low side pressures to diagnose the refrigerant charge and system condition", tools: ["AC manifold gauge set"], procedure: "Connect gauges to low and high side service ports. Engine running, AC on max, windows open. Read both gauges. Compare to spec for your refrigerant type.", expectedGood: "Low side 25-35 PSI, high side 200-300 PSI (R-134a at 80F ambient)", expectedBad: "Both low = undercharge. Low side high + high side low = compressor weak. Both high = overcharge or condenser restriction", difficulty: "intermediate", discriminates: ["ac-refrigerant", "ac-compressor", "ac-condenser", "ac-expansion"], passEffects: [{ hypothesisId: "ac-refrigerant", delta: -15 }], failEffects: [{ hypothesisId: "ac-refrigerant", delta: 20 }] },
    { id: "ac-t2", name: "Compressor clutch circuit test", purpose: "Verifies the compressor clutch coil is receiving power", tools: ["Multimeter"], procedure: "Locate the compressor clutch connector. With AC requested, check for 12V at the connector. If 12V present but clutch does not engage, the clutch coil is open. If no 12V, trace upstream (relay, fuse, pressure switch).", expectedGood: "12V present and clutch engages - circuit is good", expectedBad: "No voltage = relay/fuse/switch issue. Voltage present but no engagement = bad clutch coil", difficulty: "intermediate", discriminates: ["ac-electrical", "ac-compressor"], passEffects: [{ hypothesisId: "ac-electrical", delta: -20 }], failEffects: [{ hypothesisId: "ac-electrical", delta: 20 }] },
    { id: "ac-t3", name: "Vent temperature measurement", purpose: "Quantifies AC output temperature to confirm system performance", tools: ["Thermometer (probe type)"], procedure: "Insert thermometer probe into center dash vent. Run AC on max cold, recirculate, max blower. Let system run 5 minutes with doors closed.", expectedGood: "Vent temps 35-45F in moderate ambient conditions", expectedBad: "Vent temps above 55F indicate a system problem", difficulty: "beginner", discriminates: ["ac-refrigerant", "ac-blend"], passEffects: [], failEffects: [] },
  ],
};

const transmissionIssue: CategoryDefinition = {
  id: "transmission-issue",
  name: "Transmission Slip / Harsh Shift",
  icon: "repeat",
  description: "Slipping, harsh shifts, delayed engagement, or shudder",
  hypotheses: [
    { id: "tr-fluid", name: "Low or degraded transmission fluid", baseConfidence: 30, description: "Fluid is low from a leak, or has degraded from heat and age, losing its friction properties.", difficulty: "easy", costRange: "$20-150", safetyLevel: "diy-safe", toolLevel: "Drain pan, funnel" },
    { id: "tr-solenoid", name: "Shift solenoid failure", baseConfidence: 22, description: "An electronically-controlled shift solenoid is stuck open or closed, preventing proper gear engagement.", difficulty: "moderate", costRange: "$100-400", safetyLevel: "use-caution", toolLevel: "Scan tool, socket set" },
    { id: "tr-clutches", name: "Worn clutch packs or bands", baseConfidence: 18, description: "Internal friction material has worn, causing slippage during shifts. Typically a rebuild or replacement situation.", difficulty: "hard", costRange: "$1500-4000", safetyLevel: "professional", toolLevel: "Transmission shop" },
    { id: "tr-valvebody", name: "Valve body issue", baseConfidence: 13, description: "The hydraulic valve body has worn bores or stuck valves, causing erratic shift timing and pressure.", difficulty: "hard", costRange: "$400-1200", safetyLevel: "professional", toolLevel: "Transmission shop" },
    { id: "tr-converter", name: "Torque converter shudder or failure", baseConfidence: 10, description: "The torque converter lockup clutch is slipping or shuddering, typically felt as a vibration at light throttle between 35-55 MPH.", difficulty: "hard", costRange: "$500-1500", safetyLevel: "professional", toolLevel: "Transmission shop" },
    { id: "tr-software", name: "Adaptive learning / software needs reset", baseConfidence: 7, description: "The TCM adaptive shift tables are corrupted or need resetting after fluid change or battery disconnect.", difficulty: "easy", costRange: "$0-150", safetyLevel: "diy-safe", toolLevel: "Scan tool" },
  ],
  questions: [
    { id: "tr-q1", text: "What is the transmission fluid level and color?", whyAsking: "Low fluid causes erratic shifts and slip. Dark or burnt-smelling fluid indicates overheating and degradation of friction modifiers.", options: [
      { label: "Low on the dipstick", value: "low", effects: [{ hypothesisId: "tr-fluid", delta: 25 }] },
      { label: "Full but dark or burnt smell", value: "dark", effects: [{ hypothesisId: "tr-fluid", delta: 15 }, { hypothesisId: "tr-clutches", delta: 15 }] },
      { label: "Full and red/clean", value: "good", effects: [{ hypothesisId: "tr-fluid", delta: -20 }] },
      { label: "No dipstick / sealed unit", value: "sealed", effects: [] },
    ] },
    { id: "tr-q2", text: "Which shifts are affected?", whyAsking: "Problems in specific gears point to specific clutch packs or solenoids. All gears suggest a systemic issue like fluid or valve body.", options: [
      { label: "1-2 shift", value: "1-2", effects: [{ hypothesisId: "tr-solenoid", delta: 10 }] },
      { label: "2-3 or 3-4 shift", value: "mid", effects: [{ hypothesisId: "tr-solenoid", delta: 10 }, { hypothesisId: "tr-converter", delta: 10 }] },
      { label: "All shifts feel wrong", value: "all", effects: [{ hypothesisId: "tr-fluid", delta: 15 }, { hypothesisId: "tr-valvebody", delta: 15 }] },
      { label: "Shudder at highway speed", value: "shudder", effects: [{ hypothesisId: "tr-converter", delta: 25 }] },
    ] },
    { id: "tr-q3", text: "Is the check engine or transmission warning light on?", whyAsking: "Stored codes like P0700 (transmission fault) or P07xx solenoid codes can immediately identify the failing component.", options: [
      { label: "Yes, transmission light or check engine", value: "yes", effects: [{ hypothesisId: "tr-solenoid", delta: 15 }, { hypothesisId: "tr-software", delta: 5 }] },
      { label: "No warning lights", value: "no", effects: [{ hypothesisId: "tr-solenoid", delta: -5 }] },
    ] },
    { id: "tr-q4", text: "Does the issue happen when cold, warm, or both?", whyAsking: "Cold-only harshness can be normal adaptive behavior or fluid viscosity. Warm-only slippage suggests worn clutches or degraded fluid.", options: [
      { label: "Only when cold", value: "cold", effects: [{ hypothesisId: "tr-software", delta: 15 }, { hypothesisId: "tr-fluid", delta: 10 }] },
      { label: "Only when warm/hot", value: "warm", effects: [{ hypothesisId: "tr-clutches", delta: 15 }, { hypothesisId: "tr-fluid", delta: 10 }] },
      { label: "Both", value: "both", effects: [{ hypothesisId: "tr-valvebody", delta: 10 }] },
    ] },
    { id: "tr-q5", text: "What is the vehicle's mileage?", whyAsking: "Transmissions have expected service lives. Under 80K, internal wear is less likely. Over 150K without fluid changes, clutch wear is expected.", options: [
      { label: "Under 80,000 miles", value: "low", effects: [{ hypothesisId: "tr-clutches", delta: -10 }, { hypothesisId: "tr-solenoid", delta: 5 }] },
      { label: "80,000 - 150,000 miles", value: "mid", effects: [] },
      { label: "Over 150,000 miles", value: "high", effects: [{ hypothesisId: "tr-clutches", delta: 15 }, { hypothesisId: "tr-converter", delta: 10 }] },
    ] },
  ],
  tests: [
    { id: "tr-t1", name: "Fluid level and condition check", purpose: "Verifies proper fluid level and assesses fluid health", tools: ["Dipstick (if equipped)", "White paper towel"], procedure: "With engine running in park on level ground, check dipstick level (if equipped). Wipe fluid on white paper towel. Fresh fluid is bright red. Aged fluid is darker. Burnt fluid is brown/black with a burnt smell.", expectedGood: "Full, red/pink fluid with no burnt odor", expectedBad: "Low level (indicates leak), dark color (degraded), or burnt smell (overheated)", difficulty: "beginner", discriminates: ["tr-fluid"], passEffects: [{ hypothesisId: "tr-fluid", delta: -20 }], failEffects: [{ hypothesisId: "tr-fluid", delta: 20 }] },
    { id: "tr-t2", name: "Transmission code scan", purpose: "Reads stored diagnostic trouble codes from the TCM", tools: ["OBD2 scan tool with enhanced transmission mode"], procedure: "Connect scan tool. Read codes from PCM and TCM. Look for P07xx (transmission-specific) codes. Record all codes and freeze-frame data.", expectedGood: "No transmission-related codes stored", expectedBad: "Solenoid codes (P0750-P0770) = solenoid issue. Slip codes (P0730-P0736) = clutch or pressure problem", difficulty: "beginner", discriminates: ["tr-solenoid", "tr-clutches"], passEffects: [{ hypothesisId: "tr-solenoid", delta: -10 }], failEffects: [{ hypothesisId: "tr-solenoid", delta: 20 }] },
    { id: "tr-t3", name: "Line pressure test", purpose: "Measures hydraulic pressure inside the transmission to assess pump and clutch apply circuits", tools: ["Transmission pressure gauge", "Service manual for specs"], procedure: "Locate the line pressure test port on the transmission case. Connect pressure gauge. Start engine, apply brakes firmly. Shift through gears and record pressure in each range.", expectedGood: "Pressure meets factory spec in all ranges (typically 60-100 PSI in drive, higher in reverse)", expectedBad: "Low pressure across all ranges = pump issue. Low in one range = specific circuit leak or clutch pack wear", difficulty: "advanced", discriminates: ["tr-clutches", "tr-valvebody"], passEffects: [{ hypothesisId: "tr-clutches", delta: -15 }], failEffects: [{ hypothesisId: "tr-clutches", delta: 20 }, { hypothesisId: "tr-valvebody", delta: 15 }] },
  ],
};

export const DIAGNOSTIC_CATEGORIES: CategoryDefinition[] = [
  noCrank,
  noStart,
  overheating,
  misfire,
  chargingSystem,
  brakeNoise,
  frontEndClunk,
  parasiticDrain,
  acNotCold,
  transmissionIssue,
];

export function computeHypotheses(
  category: CategoryDefinition,
  answers: Record<string, string>,
  completedTests: Record<string, TestResult>,
): ScoredHypothesis[] {
  const scores: Record<string, number> = {};
  const supporting: Record<string, string[]> = {};
  const contradicting: Record<string, string[]> = {};

  for (const h of category.hypotheses) {
    scores[h.id] = h.baseConfidence;
    supporting[h.id] = [];
    contradicting[h.id] = [];
  }

  for (const q of category.questions) {
    const answerValue = answers[q.id];
    if (!answerValue) continue;

    const selectedOption = q.options.find(o => o.value === answerValue);
    if (!selectedOption) continue;

    for (const effect of selectedOption.effects) {
      if (scores[effect.hypothesisId] === undefined) continue;
      scores[effect.hypothesisId] += effect.delta;
      if (effect.delta > 0) {
        supporting[effect.hypothesisId].push(selectedOption.label);
      } else if (effect.delta < 0) {
        contradicting[effect.hypothesisId].push(selectedOption.label);
      }
    }
  }

  for (const test of category.tests) {
    const testResult = completedTests[test.id];
    if (!testResult) continue;

    if (testResult.result === "inconclusive") continue;
    const effects = testResult.result === "pass" ? test.passEffects : test.failEffects;
    for (const effect of effects) {
      if (scores[effect.hypothesisId] === undefined) continue;
      scores[effect.hypothesisId] += effect.delta;
      const label = `${test.name}: ${testResult.result}`;
      if (effect.delta > 0) {
        supporting[effect.hypothesisId].push(label);
      } else if (effect.delta < 0) {
        contradicting[effect.hypothesisId].push(label);
      }
    }
  }

  for (const id of Object.keys(scores)) {
    if (scores[id] < 0) scores[id] = 0;
  }

  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);

  const results: ScoredHypothesis[] = category.hypotheses.map(h => {
    const rawScore = scores[h.id];
    const confidence = totalScore > 0 ? Math.round((rawScore / totalScore) * 100) : 0;

    const availableTests = category.tests.filter(
      t => t.discriminates.includes(h.id) && !completedTests[t.id]
    );

    return {
      id: h.id,
      name: h.name,
      confidence,
      rawScore,
      description: h.description,
      supportingEvidence: supporting[h.id],
      contradictingEvidence: contradicting[h.id],
      difficulty: h.difficulty,
      costRange: h.costRange,
      safetyLevel: h.safetyLevel,
      toolLevel: h.toolLevel,
      nextTest: availableTests[0] || null,
    };
  });

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

export function getNextQuestion(
  category: CategoryDefinition,
  answers: Record<string, string>,
): NarrowingQuestion | null {
  for (const q of category.questions) {
    if (answers[q.id]) continue;

    if (q.prerequisites) {
      const met = q.prerequisites.every(
        p => answers[p.questionId] && p.values.includes(answers[p.questionId])
      );
      if (!met) continue;
    }

    return q;
  }
  return null;
}

export function getNextTest(
  category: CategoryDefinition,
  hypotheses: ScoredHypothesis[],
  completedTests: Record<string, TestResult>,
): DiagnosticTest | null {
  const top = hypotheses[0];
  const runner = hypotheses[1];
  if (!top) return null;

  if (top && runner) {
    const discriminatingTest = category.tests.find(
      t => !completedTests[t.id] && t.discriminates.includes(top.id) && t.discriminates.includes(runner.id)
    );
    if (discriminatingTest) return discriminatingTest;
  }

  if (top.nextTest) return top.nextTest;

  for (const test of category.tests) {
    if (!completedTests[test.id]) return test;
  }

  return null;
}

export function generateAssessment(
  category: CategoryDefinition,
  answers: Record<string, string>,
  completedTests: Record<string, TestResult>,
): DiagnosticAssessment {
  const hypotheses = computeHypotheses(category, answers, completedTests);
  const nextQuestion = getNextQuestion(category, answers);
  const nextTest = getNextTest(category, hypotheses, completedTests);

  const answeredCount = category.questions.filter(q => answers[q.id]).length;
  const totalQuestions = category.questions.length;
  const completedTestCount = category.tests.filter(t => completedTests[t.id]).length;
  const progress = (answeredCount + completedTestCount) / (totalQuestions + category.tests.length);

  let phaseLabel: "narrowing" | "testing" | "conclusion" = "narrowing";
  if (!nextQuestion && !nextTest) {
    phaseLabel = "conclusion";
  } else if (!nextQuestion) {
    phaseLabel = "testing";
  }

  const top = hypotheses[0];
  const runner = hypotheses[1];
  let summary = "";

  if (answeredCount === 0 && completedTestCount === 0) {
    summary = `Diagnosing ${category.name}. Answer each question to narrow the field.`;
  } else if (top && runner) {
    if (top.confidence >= 50) {
      summary = `Strong indicator: ${top.name} at ${top.confidence}%. ${runner.name} still in play at ${runner.confidence}%.`;
    } else if (top.confidence - runner.confidence > 15) {
      summary = `Leading cause: ${top.name} (${top.confidence}%). Runner-up: ${runner.name} (${runner.confidence}%).`;
    } else {
      summary = `${top.name} (${top.confidence}%) and ${runner.name} (${runner.confidence}%) are close. More data needed to separate them.`;
    }

    if (phaseLabel === "testing" && nextTest) {
      summary += ` Next step: ${nextTest.name}.`;
    } else if (phaseLabel === "conclusion") {
      summary += " All questions and tests complete.";
    }
  }

  return {
    summary,
    hypotheses,
    nextQuestion,
    nextTest,
    progress,
    answeredCount,
    totalQuestions,
  };
}

export function generateExportSummary(
  session: DiagnosticSessionData,
  category: CategoryDefinition | null,
): ExportSummary {
  const answeredSymptoms: string[] = [];
  if (category) {
    for (const q of category.questions) {
      const val = session.answers[q.id];
      if (!val) continue;
      const opt = q.options.find(o => o.value === val);
      if (opt) answeredSymptoms.push(`${opt.label}`);
    }
  }

  const testsPerformed = category
    ? category.tests
        .filter(t => session.completedTests[t.id])
        .map(t => ({
          name: t.name,
          result: session.completedTests[t.id].result,
          notes: session.completedTests[t.id].notes,
        }))
    : [];

  const hypotheses = category
    ? computeHypotheses(category, session.answers, session.completedTests)
    : [];

  const likelyCauses = hypotheses.filter(h => h.confidence >= 5).slice(0, 5).map(h => ({
    name: h.name,
    confidence: h.confidence,
    description: h.description,
  }));

  const topCause = hypotheses[0];
  const recommendedNextStep = topCause
    ? topCause.nextTest
      ? `${topCause.nextTest.name} -- ${topCause.nextTest.purpose}`
      : `Primary suspect: ${topCause.name} (${topCause.confidence}%). Proceed with repair or professional verification.`
    : "Gather more data.";

  return {
    vehicle: session.vehicle,
    complaint: category ? category.name : "Unknown",
    symptoms: answeredSymptoms,
    dtcCodes: session.dtcCodes,
    recentRepairs: session.recentRepairs,
    testsPerformed,
    likelyCauses,
    recommendedNextStep,
    notes: session.notes,
    generatedAt: new Date().toISOString(),
  };
}

export function createEmptySession(): DiagnosticSessionData {
  return {
    vehicle: {},
    recentRepairs: "",
    dtcCodes: [],
    categoryId: null,
    answers: {},
    completedTests: {},
    notes: "",
    phase: "intake",
  };
}
