export const brand = {
  name: 'TorqueShed',
  tagline: 'The Garage for Real People',
  legalName: 'TorqueShed, LLC',
  supportEmail: 'support@torqueshed.com',
} as const;

export const screenTitles = {
  home: 'TorqueShed',
  bays: 'Bays',
  notes: 'Garage',
  torqueAssist: 'TorqueAssist',
  toolGear: 'Tool & Gear',
  swapShop: 'Swap Shop',
  profile: 'Profile',
  settings: 'Settings',
  adminProducts: 'Manage Products',
  submitProduct: 'Submit Product',
  addVehicle: 'Add Vehicle',
  addNote: 'Add Note',
} as const;

export const garageBrandColors = {
  ford: '#003478',
  dodge: '#C8102E',
  chevy: '#F2A900',
  jeep: '#006341',
  general: '#6B6B6B',
  'swap-shop': '#FF6B35',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  fontFamily: {
    heading: 'Montserrat_700Bold',
    headingSemiBold: 'Montserrat_600SemiBold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_500Medium',
    mono: 'monospace',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
} as const;

export const elevation = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

const primitiveColors = {
  orange: {
    50: '#FFF3ED',
    100: '#FFE4D6',
    200: '#FFC9AD',
    300: '#FFAB7A',
    400: '#FF8A47',
    500: '#FF6B35',
    600: '#E65A2E',
    700: '#BF4726',
    800: '#99371E',
    900: '#732A16',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0D0F12',
  },
} as const;

export const darkTheme = {
  primary: primitiveColors.orange[500],
  primaryHover: primitiveColors.orange[600],
  primaryMuted: primitiveColors.orange[500] + '20',
  bg: primitiveColors.neutral[950],
  bgElevated: primitiveColors.neutral[900],
  surface: primitiveColors.neutral[800],
  surfaceHover: primitiveColors.neutral[700],
  surfaceActive: primitiveColors.neutral[600],
  border: primitiveColors.neutral[700],
  borderMuted: primitiveColors.neutral[800],
  borderFocus: primitiveColors.orange[500],
  text: primitiveColors.neutral[50],
  textSecondary: primitiveColors.neutral[400],
  textMuted: primitiveColors.neutral[500],
  textInverse: primitiveColors.neutral[950],
  success: '#22C55E',
  successMuted: '#22C55E20',
  warning: '#F59E0B',
  warningMuted: '#F59E0B20',
  danger: '#EF4444',
  dangerMuted: '#EF444420',
  info: '#3B82F6',
  infoMuted: '#3B82F620',
  tabIconSelected: primitiveColors.orange[500],
  tabIconDefault: primitiveColors.neutral[500],
  link: primitiveColors.orange[500],
} as const;

export const lightTheme = {
  primary: primitiveColors.orange[500],
  primaryHover: primitiveColors.orange[600],
  primaryMuted: primitiveColors.orange[500] + '15',
  bg: primitiveColors.neutral[50],
  bgElevated: primitiveColors.neutral[0],
  surface: primitiveColors.neutral[100],
  surfaceHover: primitiveColors.neutral[200],
  surfaceActive: primitiveColors.neutral[300],
  border: primitiveColors.neutral[200],
  borderMuted: primitiveColors.neutral[100],
  borderFocus: primitiveColors.orange[500],
  text: primitiveColors.neutral[900],
  textSecondary: primitiveColors.neutral[600],
  textMuted: primitiveColors.neutral[500],
  textInverse: primitiveColors.neutral[50],
  success: '#22C55E',
  successMuted: '#22C55E15',
  warning: '#F59E0B',
  warningMuted: '#F59E0B15',
  danger: '#EF4444',
  dangerMuted: '#EF444415',
  info: '#3B82F6',
  infoMuted: '#3B82F615',
  tabIconSelected: primitiveColors.orange[500],
  tabIconDefault: primitiveColors.neutral[500],
  link: primitiveColors.orange[500],
} as const;

export const emptyStates = {
  vehicles: {
    title: 'No Vehicles Yet',
    message: 'Add your vehicle to get better diagnostics.',
    action: 'Add Vehicle',
  },
  notes: {
    title: 'No Journal Entries Yet',
    message: 'Start documenting your maintenance, mods, and build progress.',
    action: 'Add Entry',
  },
  parts: {
    title: 'Find the Right Part',
    message: 'Enter your vehicle info and the part you need - TorqueAssist will search multiple vendors to find the best deal.',
    action: 'Search Parts',
  },
  bay: {
    title: 'Join a Bay',
    message: 'Connect with other enthusiasts in brand-specific bays.',
    action: 'Browse Bays',
  },
  threads: {
    title: 'No Threads Yet',
    message: 'Start a thread and get the conversation going.',
    action: 'New Thread',
  },
  products: {
    title: 'No Products Found',
    message: 'Check back soon for curated deals from trusted vendors.',
    action: 'Explore Categories',
  },
  swapShop: {
    title: 'Nothing Listed Yet',
    message: 'List a spare part, tool, or service.',
    action: 'New Listing',
  },
} as const;

export const microcopy = {
  new: 'New',
  solved: 'Solved',
  post: 'Post',
  addVehicle: 'Add Vehicle',
  addNote: 'Add Note',
  assistMe: 'Assist Me',
  viewDeal: 'View Deal',
} as const;

export const placeholders = {
  message: 'Type a message...',
  vin: '1FTEW1EP7KFC12345',
  year: '2019',
  make: 'Ford',
  model: 'F-150',
  partName: 'Describe the part you need...',
} as const;
