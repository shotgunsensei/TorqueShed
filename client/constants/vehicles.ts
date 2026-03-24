export interface Vehicle {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  nickname?: string;
  imageUri?: string;
  notesCount: number;
}

export type NoteType = "maintenance" | "mod" | "issue" | "general";

export interface VehicleNote {
  id: string;
  vehicleId: string;
  title: string;
  content: string;
  type: NoteType;
  cost: string | null;
  mileage: number | null;
  partsUsed: string[] | null;
  createdAt: Date;
  isPrivate: boolean;
}

export const MAKES = ["Ford", "Chevrolet", "Dodge", "Jeep", "Toyota", "Honda", "Nissan", "GMC", "Ram", "BMW", "Mercedes", "Audi"];

export const YEARS = Array.from({ length: 30 }, (_, i) => 2025 - i);
