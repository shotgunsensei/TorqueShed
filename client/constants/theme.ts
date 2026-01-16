import { Platform } from "react-native";
import { 
  darkTheme, 
  lightTheme, 
  garageBrandColors,
  spacing as brandSpacing,
  radius,
  typography as brandTypography,
  elevation,
} from "@gearhead/shared";

export const Colors = {
  light: {
    text: lightTheme.text,
    textSecondary: lightTheme.textSecondary,
    textMuted: lightTheme.textMuted,
    buttonText: "#FFFFFF",
    tabIconDefault: lightTheme.textMuted,
    tabIconSelected: lightTheme.primary,
    link: lightTheme.primary,
    primary: lightTheme.primary,
    primaryHover: lightTheme.primaryHover,
    secondary: lightTheme.surface,
    accent: lightTheme.warning,
    success: lightTheme.success,
    error: lightTheme.danger,
    backgroundRoot: lightTheme.bg,
    backgroundDefault: lightTheme.bgElevated,
    backgroundSecondary: lightTheme.surface,
    backgroundTertiary: lightTheme.surfaceHover,
    border: lightTheme.border,
    cardBorder: lightTheme.borderMuted,
  },
  dark: {
    text: darkTheme.text,
    textSecondary: darkTheme.textSecondary,
    textMuted: darkTheme.textMuted,
    buttonText: "#FFFFFF",
    tabIconDefault: darkTheme.textMuted,
    tabIconSelected: darkTheme.primary,
    link: darkTheme.primary,
    primary: darkTheme.primary,
    primaryHover: darkTheme.primaryHover,
    secondary: darkTheme.surface,
    accent: darkTheme.warning,
    success: darkTheme.success,
    error: darkTheme.danger,
    backgroundRoot: darkTheme.bg,
    backgroundDefault: darkTheme.bgElevated,
    backgroundSecondary: darkTheme.surface,
    backgroundTertiary: darkTheme.surfaceHover,
    border: darkTheme.border,
    cardBorder: darkTheme.borderMuted,
  },
};

export const BrandColors = {
  ford: garageBrandColors.ford,
  dodge: garageBrandColors.dodge,
  chevy: garageBrandColors.chevy,
  jeep: garageBrandColors.jeep,
  general: garageBrandColors.general,
  swapShop: garageBrandColors['swap-shop'],
};

export const Spacing = {
  xxs: brandSpacing.xxs,
  xs: brandSpacing.xs,
  sm: brandSpacing.sm,
  md: brandSpacing.md,
  lg: brandSpacing.lg,
  xl: brandSpacing.xl,
  "2xl": brandSpacing.xxl,
  "3xl": brandSpacing.xxxl,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  none: radius.none,
  xs: radius.sm,
  sm: radius.md,
  md: radius.lg,
  lg: radius.xl,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: radius.full,
};

export const Typography = {
  display: {
    fontSize: brandTypography.fontSize.display,
    lineHeight: 48,
    fontWeight: "700" as const,
    fontFamily: brandTypography.fontFamily.heading,
  },
  h1: {
    fontSize: brandTypography.fontSize.xxl,
    lineHeight: 32,
    fontWeight: "700" as const,
    fontFamily: brandTypography.fontFamily.heading,
  },
  h2: {
    fontSize: brandTypography.fontSize.xl,
    lineHeight: 28,
    fontWeight: "600" as const,
    fontFamily: brandTypography.fontFamily.headingSemiBold,
  },
  h3: {
    fontSize: brandTypography.fontSize.lg,
    lineHeight: 26,
    fontWeight: "600" as const,
    fontFamily: brandTypography.fontFamily.headingSemiBold,
  },
  h4: {
    fontSize: brandTypography.fontSize.md,
    lineHeight: 24,
    fontWeight: "600" as const,
    fontFamily: brandTypography.fontFamily.headingSemiBold,
  },
  body: {
    fontSize: brandTypography.fontSize.md,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: brandTypography.fontFamily.body,
  },
  small: {
    fontSize: brandTypography.fontSize.sm,
    lineHeight: 20,
    fontWeight: "400" as const,
    fontFamily: brandTypography.fontFamily.body,
  },
  caption: {
    fontSize: brandTypography.fontSize.xs,
    lineHeight: 16,
    fontWeight: "400" as const,
    fontFamily: brandTypography.fontFamily.body,
  },
  link: {
    fontSize: brandTypography.fontSize.md,
    lineHeight: 24,
    fontWeight: "500" as const,
    fontFamily: brandTypography.fontFamily.bodyMedium,
  },
};

export const Shadows = {
  none: elevation.none,
  small: elevation.sm,
  medium: elevation.md,
  large: elevation.lg,
};

export const Fonts = Platform.select({
  ios: {
    sans: brandTypography.fontFamily.body,
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: brandTypography.fontFamily.mono,
  },
  default: {
    sans: brandTypography.fontFamily.body,
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
