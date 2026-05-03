/**
 * Accessibility helpers for TorqueShed.
 *
 * Conventions enforced (and checked by scripts/check-a11y.sh):
 *   1. Every interactive primitive (Pressable, TouchableOpacity, Button,
 *      TextInput, Input, FAB) must declare `accessibilityLabel` describing
 *      what activating it does, in plain language.
 *   2. Every interactive primitive must carry a stable `testID`. Use
 *      `{action}-{target}` for buttons (e.g. `button-submit-report`),
 *      `input-{field}` for text inputs, and append a stable id for items in
 *      lists (e.g. `card-product-${id}`).
 *   3. Use `accessibilityHint` only when the label alone is ambiguous.
 *   4. Status, urgency and tab pickers should use role=radio / role=tab and
 *      report selection via `accessibilityState.selected`.
 *   5. Toggleable chips should use role=checkbox with `accessibilityState.checked`.
 *   6. Decorative images (logos, illustrations) must use `a11yDecorativeImage`.
 *   7. Form errors and toasts announce via `accessibilityLiveRegion="polite"`
 *      and (for errors) role=alert.
 *
 * Prefer the helpers below to keep wording consistent across screens.
 */
import type { AccessibilityProps, AccessibilityRole } from "react-native";

export interface A11yOptions {
  label: string;
  hint?: string;
  state?: AccessibilityProps["accessibilityState"];
  testID?: string;
}

export function a11yButton(label: string, hint?: string): AccessibilityProps {
  return {
    accessibilityRole: "button" as AccessibilityRole,
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

export function a11yLink(label: string, hint?: string): AccessibilityProps {
  return {
    accessibilityRole: "link" as AccessibilityRole,
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

export function a11yImage(label: string): AccessibilityProps {
  return {
    accessibilityRole: "image" as AccessibilityRole,
    accessibilityLabel: label,
  };
}

export function a11yDecorativeImage(): AccessibilityProps {
  return {
    accessibilityElementsHidden: true,
    importantForAccessibility: "no",
  };
}

export function a11yHeader(label: string): AccessibilityProps {
  return {
    accessibilityRole: "header" as AccessibilityRole,
    accessibilityLabel: label,
  };
}

export function a11yToggle(label: string, value: boolean, hint?: string): AccessibilityProps {
  return {
    accessibilityRole: "switch" as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityState: { checked: value },
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

export function a11yFormError(message: string): AccessibilityProps {
  return {
    accessibilityRole: "alert" as AccessibilityRole,
    accessibilityLiveRegion: "polite",
    accessibilityLabel: message,
  };
}

export function a11yLiveStatus(message: string): AccessibilityProps {
  return {
    accessibilityLiveRegion: "polite",
    accessibilityLabel: message,
  };
}

export function a11yBadge(label: string): AccessibilityProps {
  return {
    accessibilityLabel: label,
  };
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

export function statusLabel(prefix: string, count: number, noun: string): string {
  return `${prefix}, ${pluralize(count, noun)}`;
}
