import { useResponsive } from "@/hooks/useResponsive";

export function useSafeTabBarHeight(): number {
  const { isDesktop } = useResponsive();
  
  if (isDesktop) {
    return 0;
  }
  
  try {
    const { useBottomTabBarHeight } = require("@react-navigation/bottom-tabs");
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}
