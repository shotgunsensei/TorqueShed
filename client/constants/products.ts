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

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "1",
    title: "K&N Cold Air Intake Kit",
    description: "High-flow performance air intake for improved horsepower and throttle response",
    price: "$349.99",
    vendor: "K&N Engineering",
    affiliateUrl: "https://example.com/kn-intake",
    category: "Performance",
    isApproved: true,
  },
  {
    id: "2",
    title: "Bilstein 5100 Shock Kit",
    description: "Premium monotube shocks for lifted trucks, adjustable ride height",
    price: "$599.99",
    vendor: "Bilstein",
    affiliateUrl: "https://example.com/bilstein",
    category: "Suspension",
    isApproved: true,
  },
  {
    id: "3",
    title: "Flowmaster Super 44 Muffler",
    description: "Aggressive deep tone exhaust with improved flow",
    price: "$179.99",
    vendor: "Flowmaster",
    affiliateUrl: "https://example.com/flowmaster",
    category: "Exhaust",
    isApproved: true,
  },
  {
    id: "4",
    title: "Rigid Industries LED Light Bar",
    description: "20-inch spot/flood combo LED bar, 20,000 lumens",
    price: "$449.99",
    vendor: "Rigid Industries",
    affiliateUrl: "https://example.com/rigid",
    category: "Lighting",
    isApproved: true,
  },
  {
    id: "5",
    title: "WeatherTech Floor Liners",
    description: "Custom-fit floor protection for all weather conditions",
    price: "$189.99",
    vendor: "WeatherTech",
    affiliateUrl: "https://example.com/weathertech",
    category: "Interior",
    isApproved: true,
  },
  {
    id: "6",
    title: "Borla Cat-Back Exhaust",
    description: "Stainless steel performance exhaust system with deep tone",
    price: "$899.99",
    vendor: "Borla",
    affiliateUrl: "https://example.com/borla",
    category: "Exhaust",
    isApproved: true,
  },
];

export const PART_VENDORS = [
  { id: "rockauto", name: "RockAuto", logo: null },
  { id: "autozone", name: "AutoZone", logo: null },
  { id: "oreilly", name: "O'Reilly", logo: null },
  { id: "amazon", name: "Amazon", logo: null },
  { id: "ebay", name: "eBay", logo: null },
];
