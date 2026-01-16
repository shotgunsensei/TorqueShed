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
    name: "Ford Bay",
    brandKey: "ford",
    memberCount: 12453,
    activeNow: 89,
    description: "Built Ford Tough community",
  },
  {
    id: "dodge",
    name: "Dodge Bay",
    brandKey: "dodge",
    memberCount: 8921,
    activeNow: 67,
    description: "Mopar or no car enthusiasts",
  },
  {
    id: "chevy",
    name: "Chevy Bay",
    brandKey: "chevy",
    memberCount: 10234,
    activeNow: 72,
    description: "Like a rock community",
  },
  {
    id: "jeep",
    name: "Jeep Bay",
    brandKey: "jeep",
    memberCount: 15678,
    activeNow: 124,
    description: "Trail rated adventurers",
  },
  {
    id: "general",
    name: "General Bay",
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

const NOW = Date.now();
const HOUR = 3600000;
const DAY = 86400000;

export const SAMPLE_THREADS: Thread[] = [
  {
    id: "1",
    title: "Best cold air intake for 5.0 Coyote?",
    author: "gearhead_mike",
    replies: 24,
    lastActivity: "2h ago",
    lastActivityTime: NOW - 2 * HOUR,
    garageId: "ford",
    isNew: false,
    hasSolution: true,
    createdAt: NOW - 3 * DAY,
  },
  {
    id: "2",
    title: "Transmission rebuild tips needed",
    author: "wrench_warrior",
    replies: 18,
    lastActivity: "4h ago",
    lastActivityTime: NOW - 4 * HOUR,
    garageId: "ford",
    isNew: false,
    hasSolution: false,
    createdAt: NOW - 2 * DAY,
  },
  {
    id: "3",
    title: "Check engine light P0420 - cat or O2 sensor?",
    author: "diag_dave",
    replies: 6,
    lastActivity: "30m ago",
    lastActivityTime: NOW - 0.5 * HOUR,
    garageId: "ford",
    isNew: true,
    hasSolution: false,
    createdAt: NOW - 2 * HOUR,
  },
  {
    id: "4",
    title: "LED headlight conversion complete",
    author: "night_rider",
    replies: 42,
    lastActivity: "1h ago",
    lastActivityTime: NOW - HOUR,
    garageId: "dodge",
    isNew: false,
    hasSolution: true,
    createdAt: NOW - 5 * DAY,
  },
  {
    id: "5",
    title: "Death wobble fix - finally solved",
    author: "trail_master",
    replies: 67,
    lastActivity: "45m ago",
    lastActivityTime: NOW - 0.75 * HOUR,
    garageId: "jeep",
    isNew: false,
    hasSolution: true,
    createdAt: NOW - 7 * DAY,
  },
  {
    id: "6",
    title: "LS swap into classic C10 - wiring help",
    author: "shop_rat",
    replies: 31,
    lastActivity: "3h ago",
    lastActivityTime: NOW - 3 * HOUR,
    garageId: "chevy",
    isNew: false,
    hasSolution: false,
    createdAt: NOW - 4 * DAY,
  },
  {
    id: "7",
    title: "Hemi tick - should I be worried?",
    author: "mopar_mike",
    replies: 12,
    lastActivity: "20m ago",
    lastActivityTime: NOW - 0.33 * HOUR,
    garageId: "dodge",
    isNew: true,
    hasSolution: false,
    createdAt: NOW - 1 * HOUR,
  },
  {
    id: "8",
    title: "Brake upgrade recommendations for towing",
    author: "haul_it_all",
    replies: 8,
    lastActivity: "5h ago",
    lastActivityTime: NOW - 5 * HOUR,
    garageId: "general",
    isNew: false,
    hasSolution: true,
    createdAt: NOW - 3 * DAY,
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
