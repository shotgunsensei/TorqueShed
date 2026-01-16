import { BrandColors } from "./theme";

export interface Garage {
  id: string;
  name: string;
  brandKey: keyof typeof BrandColors;
  memberCount: number;
  activeNow: number;
  description: string;
}

export const GARAGES: Garage[] = [
  {
    id: "ford",
    name: "Ford Garage",
    brandKey: "ford",
    memberCount: 12453,
    activeNow: 89,
    description: "Built Ford Tough community",
  },
  {
    id: "dodge",
    name: "Dodge Garage",
    brandKey: "dodge",
    memberCount: 8921,
    activeNow: 67,
    description: "Mopar or no car enthusiasts",
  },
  {
    id: "chevy",
    name: "Chevy Garage",
    brandKey: "chevy",
    memberCount: 10234,
    activeNow: 72,
    description: "Like a rock community",
  },
  {
    id: "jeep",
    name: "Jeep Garage",
    brandKey: "jeep",
    memberCount: 15678,
    activeNow: 124,
    description: "Trail rated adventurers",
  },
  {
    id: "general",
    name: "General",
    brandKey: "general",
    memberCount: 23456,
    activeNow: 156,
    description: "All makes and models welcome",
  },
  {
    id: "swap-shop",
    name: "Swap Shop",
    brandKey: "swapShop",
    memberCount: 7845,
    activeNow: 45,
    description: "Buy, sell, trade parts",
  },
];

export const SAMPLE_THREADS = [
  {
    id: "1",
    title: "Best cold air intake for 5.0 Coyote?",
    author: "gearhead_mike",
    replies: 24,
    lastActivity: "2h ago",
    garageId: "ford",
  },
  {
    id: "2",
    title: "Transmission rebuild tips needed",
    author: "wrench_warrior",
    replies: 18,
    lastActivity: "4h ago",
    garageId: "ford",
  },
  {
    id: "3",
    title: "LED headlight conversion complete",
    author: "night_rider",
    replies: 42,
    lastActivity: "1h ago",
    garageId: "dodge",
  },
];

export const SAMPLE_MESSAGES = [
  {
    id: "1",
    userId: "user1",
    userName: "gearhead_mike",
    message: "Hey everyone, just joined the Ford crew!",
    timestamp: new Date(Date.now() - 3600000),
    isOwn: false,
  },
  {
    id: "2",
    userId: "user2",
    userName: "wrench_warrior",
    message: "Welcome! What are you driving?",
    timestamp: new Date(Date.now() - 3500000),
    isOwn: false,
  },
  {
    id: "3",
    userId: "current",
    userName: "You",
    message: "Thanks! 2019 F-150 with the 5.0",
    timestamp: new Date(Date.now() - 3400000),
    isOwn: true,
  },
];
