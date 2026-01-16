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

export interface VehicleNote {
  id: string;
  vehicleId: string;
  title: string;
  content: string;
  createdAt: Date;
  isPrivate: boolean;
}

export const SAMPLE_VEHICLES: Vehicle[] = [
  {
    id: "1",
    vin: "1FTFW1E50KFA12345",
    year: 2019,
    make: "Ford",
    model: "F-150",
    nickname: "Big Blue",
    notesCount: 5,
  },
  {
    id: "2",
    year: 2021,
    make: "Jeep",
    model: "Wrangler",
    nickname: "Trail Beast",
    notesCount: 3,
  },
];

export const SAMPLE_NOTES: VehicleNote[] = [
  {
    id: "1",
    vehicleId: "1",
    title: "Oil Change",
    content: "Changed oil at 45,000 miles. Used Mobil 1 5W-30, new Motorcraft filter.",
    createdAt: new Date(Date.now() - 86400000 * 7),
    isPrivate: true,
  },
  {
    id: "2",
    vehicleId: "1",
    title: "New Tires",
    content: "Installed BF Goodrich All-Terrain T/A KO2 275/65R18. Great off-road performance.",
    createdAt: new Date(Date.now() - 86400000 * 14),
    isPrivate: true,
  },
  {
    id: "3",
    vehicleId: "1",
    title: "Brake Pad Replacement",
    content: "Front brake pads replaced with Hawk HPS 5.0. Much better stopping power.",
    createdAt: new Date(Date.now() - 86400000 * 30),
    isPrivate: true,
  },
];

export const MAKES = ["Ford", "Chevrolet", "Dodge", "Jeep", "Toyota", "Honda", "Nissan", "GMC", "Ram", "BMW", "Mercedes", "Audi"];

export const YEARS = Array.from({ length: 30 }, (_, i) => 2025 - i);
