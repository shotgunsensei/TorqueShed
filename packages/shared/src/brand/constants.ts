export const app = {
  name: 'TorqueShed',
  domain: 'torqueshed.shop',
  supportEmail: 'support@torqueshed.shop',
  privacyUrl: 'https://torqueshed.shop/privacy',
  termsUrl: 'https://torqueshed.shop/terms',
  appStoreUrl: '',
  playStoreUrl: '',
} as const;

export const social = {
  instagram: '@torqueshed',
  twitter: '@torqueshed',
  youtube: '@torqueshed',
} as const;

export const limits = {
  messageMaxLength: 2000,
  threadTitleMaxLength: 255,
  threadContentMaxLength: 10000,
  replyMaxLength: 5000,
  bioMaxLength: 500,
  handleMinLength: 3,
  handleMaxLength: 50,
  noteTitleMaxLength: 255,
  noteContentMaxLength: 5000,
  productTitleMaxLength: 255,
  productDescriptionMaxLength: 2000,
  maxSpecialties: 10,
  maxVehicles: 50,
  maxNotesPerVehicle: 200,
} as const;

export const pagination = {
  defaultPageSize: 20,
  chatPageSize: 50,
  forumPageSize: 20,
  productsPageSize: 20,
  maxPageSize: 100,
} as const;

export const api = {
  timeout: 10000,
  retryCount: 3,
  retryDelay: 1000,
} as const;

export const navigation = {
  tabs: [
    { key: 'garages', label: 'Garages', icon: 'message-circle' },
    { key: 'swap', label: 'Swap Shop', icon: 'shopping-bag' },
    { key: 'notes', label: 'Notes', icon: 'file-text' },
    { key: 'parts', label: 'Parts', icon: 'tool' },
    { key: 'trending', label: 'Trending', icon: 'trending-up' },
  ],
  webRoutes: {
    garages: '/garages',
    swap: '/swap',
    notes: '/notes',
    parts: '/parts',
    trending: '/trending',
    profile: '/profile',
    garage: (id: string) => `/garages/${id}`,
    thread: (garageId: string, threadId: string) => `/garages/${garageId}/thread/${threadId}`,
    vehicle: (id: string) => `/notes/${id}`,
    product: (id: string) => `/trending/${id}`,
  },
} as const;

export const badges = [
  { id: 'ase', label: 'ASE Certified', description: 'Automotive Service Excellence certified' },
  { id: 'diesel', label: 'Diesel', description: 'Diesel engine specialist' },
  { id: 'fabrication', label: 'Fabrication', description: 'Metal fabrication and welding' },
  { id: 'tuning', label: 'Tuning', description: 'ECU tuning and calibration' },
  { id: 'electrical', label: 'Electrical', description: 'Automotive electrical systems' },
  { id: 'restoration', label: 'Restoration', description: 'Classic car restoration' },
  { id: 'offroad', label: 'Offroad', description: 'Offroad builds and overlanding' },
] as const;
