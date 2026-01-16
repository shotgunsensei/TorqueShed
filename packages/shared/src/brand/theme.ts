export const colors = {
  primary: '#FF6B35',
  primaryHover: '#E85A28',
  primaryMuted: 'rgba(255, 107, 53, 0.15)',

  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.15)',

  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',

  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',

  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.15)',
} as const;

export const darkTheme = {
  bg: '#0A0A0A',
  bgElevated: '#141414',
  surface: '#1A1A1A',
  surfaceHover: '#222222',
  surfaceActive: '#2A2A2A',

  border: '#2E2E2E',
  borderMuted: '#1F1F1F',
  borderFocus: colors.primary,

  text: '#FAFAFA',
  textSecondary: '#A1A1A1',
  textMuted: '#6B6B6B',
  textInverse: '#0A0A0A',

  ...colors,
} as const;

export const lightTheme = {
  bg: '#FAFAFA',
  bgElevated: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceHover: '#EEEEEE',
  surfaceActive: '#E5E5E5',

  border: '#E0E0E0',
  borderMuted: '#EEEEEE',
  borderFocus: colors.primary,

  text: '#0A0A0A',
  textSecondary: '#525252',
  textMuted: '#8B8B8B',
  textInverse: '#FAFAFA',

  ...colors,
} as const;

export type Theme = typeof darkTheme;
export type ThemeColors = keyof Theme;

export const garageBrandColors = {
  ford: '#003478',
  dodge: '#C8102E',
  chevy: '#F2A900',
  jeep: '#006341',
  general: '#6B6B6B',
  'swap-shop': '#FF6B35',
} as const;

export type GarageBrand = keyof typeof garageBrandColors;

export const badgeColors = {
  ase: '#1E40AF',
  diesel: '#374151',
  fabrication: '#B45309',
  tuning: '#7C3AED',
  electrical: '#0891B2',
  restoration: '#65A30D',
  offroad: '#059669',
} as const;

export type BadgeType = keyof typeof badgeColors;

export function getTheme(isDark: boolean = true): Theme {
  return isDark ? darkTheme : lightTheme;
}
