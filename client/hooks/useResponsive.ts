import { useState, useEffect } from "react";
import { Dimensions, Platform } from "react-native";

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export type ScreenSize = "mobile" | "tablet" | "desktop" | "wide";

interface ResponsiveState {
  width: number;
  height: number;
  screenSize: ScreenSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
}

function getScreenSize(width: number): ScreenSize {
  if (width >= BREAKPOINTS.wide) return "wide";
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}

export function useResponsive(): ResponsiveState {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get("window");
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription.remove();
  }, []);

  const screenSize = getScreenSize(dimensions.width);

  return {
    width: dimensions.width,
    height: dimensions.height,
    screenSize,
    isMobile: screenSize === "mobile",
    isTablet: screenSize === "tablet",
    isDesktop: screenSize === "desktop" || screenSize === "wide",
    isWide: screenSize === "wide",
  };
}

export function useColumns(baseColumns: number = 1): number {
  const { screenSize } = useResponsive();
  
  switch (screenSize) {
    case "wide":
      return Math.min(baseColumns * 4, 4);
    case "desktop":
      return Math.min(baseColumns * 3, 3);
    case "tablet":
      return Math.min(baseColumns * 2, 2);
    default:
      return baseColumns;
  }
}
