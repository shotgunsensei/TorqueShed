export interface ObdCodeInfo {
  code: string;
  description: string;
  system: string;
}

export const OBD_CODE_DATABASE: ObdCodeInfo[] = [
  { code: "P0100", description: "Mass Air Flow Circuit Malfunction", system: "Fuel & Air Metering" },
  { code: "P0101", description: "Mass Air Flow Circuit Range/Performance", system: "Fuel & Air Metering" },
  { code: "P0102", description: "Mass Air Flow Circuit Low", system: "Fuel & Air Metering" },
  { code: "P0110", description: "Intake Air Temperature Circuit Malfunction", system: "Fuel & Air Metering" },
  { code: "P0120", description: "Throttle Position Sensor Circuit Malfunction", system: "Fuel & Air Metering" },
  { code: "P0121", description: "Throttle Position Sensor Range/Performance", system: "Fuel & Air Metering" },
  { code: "P0130", description: "O2 Sensor Circuit Malfunction (Bank 1, Sensor 1)", system: "Fuel & Air Metering" },
  { code: "P0131", description: "O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)", system: "Fuel & Air Metering" },
  { code: "P0133", description: "O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)", system: "Fuel & Air Metering" },
  { code: "P0135", description: "O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 1)", system: "Fuel & Air Metering" },
  { code: "P0171", description: "System Too Lean (Bank 1)", system: "Fuel & Air Metering" },
  { code: "P0172", description: "System Too Rich (Bank 1)", system: "Fuel & Air Metering" },
  { code: "P0174", description: "System Too Lean (Bank 2)", system: "Fuel & Air Metering" },
  { code: "P0175", description: "System Too Rich (Bank 2)", system: "Fuel & Air Metering" },
  { code: "P0200", description: "Injector Circuit Malfunction", system: "Fuel & Air Metering" },
  { code: "P0201", description: "Injector Circuit Malfunction - Cylinder 1", system: "Fuel & Air Metering" },
  { code: "P0202", description: "Injector Circuit Malfunction - Cylinder 2", system: "Fuel & Air Metering" },
  { code: "P0300", description: "Random/Multiple Cylinder Misfire Detected", system: "Ignition" },
  { code: "P0301", description: "Cylinder 1 Misfire Detected", system: "Ignition" },
  { code: "P0302", description: "Cylinder 2 Misfire Detected", system: "Ignition" },
  { code: "P0303", description: "Cylinder 3 Misfire Detected", system: "Ignition" },
  { code: "P0304", description: "Cylinder 4 Misfire Detected", system: "Ignition" },
  { code: "P0305", description: "Cylinder 5 Misfire Detected", system: "Ignition" },
  { code: "P0306", description: "Cylinder 6 Misfire Detected", system: "Ignition" },
  { code: "P0307", description: "Cylinder 7 Misfire Detected", system: "Ignition" },
  { code: "P0308", description: "Cylinder 8 Misfire Detected", system: "Ignition" },
  { code: "P0325", description: "Knock Sensor 1 Circuit Malfunction", system: "Ignition" },
  { code: "P0335", description: "Crankshaft Position Sensor Circuit Malfunction", system: "Ignition" },
  { code: "P0340", description: "Camshaft Position Sensor Circuit Malfunction", system: "Ignition" },
  { code: "P0400", description: "Exhaust Gas Recirculation Flow Malfunction", system: "Emissions" },
  { code: "P0401", description: "Exhaust Gas Recirculation Flow Insufficient", system: "Emissions" },
  { code: "P0402", description: "Exhaust Gas Recirculation Flow Excessive", system: "Emissions" },
  { code: "P0410", description: "Secondary Air Injection System Malfunction", system: "Emissions" },
  { code: "P0420", description: "Catalyst System Efficiency Below Threshold (Bank 1)", system: "Emissions" },
  { code: "P0430", description: "Catalyst System Efficiency Below Threshold (Bank 2)", system: "Emissions" },
  { code: "P0440", description: "Evaporative Emission System Malfunction", system: "Emissions" },
  { code: "P0441", description: "Evaporative Emission System Incorrect Purge Flow", system: "Emissions" },
  { code: "P0442", description: "Evaporative Emission System Leak Detected (Small)", system: "Emissions" },
  { code: "P0443", description: "Evaporative Emission Purge Control Valve Circuit", system: "Emissions" },
  { code: "P0446", description: "Evaporative Emission System Vent Control Circuit", system: "Emissions" },
  { code: "P0455", description: "Evaporative Emission System Leak Detected (Large)", system: "Emissions" },
  { code: "P0500", description: "Vehicle Speed Sensor Malfunction", system: "Speed/Idle Control" },
  { code: "P0505", description: "Idle Control System Malfunction", system: "Speed/Idle Control" },
  { code: "P0507", description: "Idle Control System RPM Higher Than Expected", system: "Speed/Idle Control" },
  { code: "P0600", description: "Serial Communication Link Malfunction", system: "Computer Output" },
  { code: "P0700", description: "Transmission Control System Malfunction", system: "Transmission" },
  { code: "P0705", description: "Transmission Range Sensor Circuit Malfunction", system: "Transmission" },
  { code: "P0715", description: "Input/Turbine Speed Sensor Circuit Malfunction", system: "Transmission" },
  { code: "P0720", description: "Output Speed Sensor Circuit Malfunction", system: "Transmission" },
  { code: "P0730", description: "Incorrect Gear Ratio", system: "Transmission" },
  { code: "P0740", description: "Torque Converter Clutch Circuit Malfunction", system: "Transmission" },
  { code: "P0741", description: "Torque Converter Clutch Solenoid Performance", system: "Transmission" },
  { code: "P0750", description: "Shift Solenoid A Malfunction", system: "Transmission" },
  { code: "P0755", description: "Shift Solenoid B Malfunction", system: "Transmission" },
  { code: "P1000", description: "OBD II Monitor Testing Not Complete", system: "Manufacturer Specific" },
  { code: "B0001", description: "Driver Frontal Stage 1 Deployment Control", system: "Body" },
  { code: "B0100", description: "Electronic Frontal Sensor 1 Malfunction", system: "Body" },
  { code: "B1200", description: "Climate Control Pushbutton Circuit Malfunction", system: "Body" },
  { code: "B1234", description: "Mirror Driver Switch Circuit Short to Ground", system: "Body" },
  { code: "C0035", description: "Left Front Wheel Speed Circuit Malfunction", system: "Chassis" },
  { code: "C0040", description: "Right Front Wheel Speed Circuit Malfunction", system: "Chassis" },
  { code: "C0045", description: "Left Rear Wheel Speed Circuit Malfunction", system: "Chassis" },
  { code: "C0050", description: "Right Rear Wheel Speed Circuit Malfunction", system: "Chassis" },
  { code: "C0300", description: "Rear Speed Sensor Malfunction", system: "Chassis" },
  { code: "U0100", description: "Lost Communication With ECM/PCM", system: "Network" },
  { code: "U0101", description: "Lost Communication With TCM", system: "Network" },
  { code: "U0121", description: "Lost Communication With ABS", system: "Network" },
  { code: "U0140", description: "Lost Communication With BCM", system: "Network" },
  { code: "U0155", description: "Lost Communication With Instrument Panel Cluster", system: "Network" },
];

export function lookupObdCode(code: string): ObdCodeInfo | undefined {
  return OBD_CODE_DATABASE.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export function searchObdCodes(query: string): ObdCodeInfo[] {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase();
  return OBD_CODE_DATABASE.filter(
    (c) => c.code.includes(q) || c.description.toUpperCase().includes(q)
  ).slice(0, 10);
}

export function getObdSystemPrefix(code: string): string {
  const prefix = code.charAt(0).toUpperCase();
  switch (prefix) {
    case "P": return "Powertrain";
    case "B": return "Body";
    case "C": return "Chassis";
    case "U": return "Network";
    default: return "Unknown";
  }
}
