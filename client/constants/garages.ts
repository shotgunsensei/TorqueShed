import { BrandColors } from "./theme";

export interface Garage {
  id: string;
  name: string;
  brandKey: keyof typeof BrandColors;
  description: string;
}

export const GARAGES: Garage[] = [
  {
    id: "ford",
    name: "Ford Bay",
    brandKey: "ford",
    description: "Built Ford Tough community",
  },
  {
    id: "dodge",
    name: "Dodge Bay",
    brandKey: "dodge",
    description: "Mopar or no car enthusiasts",
  },
  {
    id: "chevy",
    name: "Chevy Bay",
    brandKey: "chevy",
    description: "Like a rock community",
  },
  {
    id: "jeep",
    name: "Jeep Bay",
    brandKey: "jeep",
    description: "Trail rated adventurers",
  },
  {
    id: "general",
    name: "General Bay",
    brandKey: "general",
    description: "All makes and models welcome",
  },
  {
    id: "swap-shop",
    name: "Swap Shop",
    brandKey: "swapShop",
    description: "Buy, sell, trade parts",
  },
];

export interface Thread {
  id: string;
  title: string;
  author: string;
  replies: number;
  lastActivity: string;
  lastActivityTime: number;
  garageId: string;
  isNew: boolean;
  hasSolution: boolean;
  createdAt: number;
}
