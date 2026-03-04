export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
  vendor: string;
  affiliateUrl: string;
  category: string;
  isApproved: boolean;
}

export const PART_VENDORS = [
  { id: "rockauto", name: "RockAuto", logo: null },
  { id: "autozone", name: "AutoZone", logo: null },
  { id: "oreilly", name: "O'Reilly", logo: null },
  { id: "amazon", name: "Amazon", logo: null },
  { id: "ebay", name: "eBay", logo: null },
];
