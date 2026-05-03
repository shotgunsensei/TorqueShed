#!/usr/bin/env bash
# Lint accessibility metadata on interactive primitives in scoped screens.
#
# For each <Pressable>, <TouchableOpacity>, <Button>, <FAB>, <TextInput>,
# <Input> or <Card> opening tag in the SCREENS list, this script verifies that
# the tag carries BOTH `accessibilityLabel` and `testID`. <Card> is a layout
# container that is only interactive when it is given an `onPress` handler, so
# we only enforce labels/testIDs on <Card> tags that include `onPress`.
#
# We strip `=>` arrow tokens and `/>` self-close tokens before locating the
# closing `>` of the opening tag so we don't get confused by JSX expressions.

set -euo pipefail

SCREENS=(
  "client/components/MediaPickerRow.tsx"
  "client/screens/LoginScreen.tsx"
  "client/screens/SignupScreen.tsx"
  "client/screens/OnboardingScreen.tsx"
  "client/screens/HomeScreen.tsx"
  "client/screens/ThreadDetailScreen.tsx"
  "client/screens/NewCaseScreen.tsx"
  "client/screens/SourceScreen.tsx"
  "client/screens/SwapShopScreen.tsx"
  "client/screens/MoreScreen.tsx"
  "client/screens/BillingScreen.tsx"
  "client/screens/SubscriptionScreen.tsx"
  "client/screens/GaragesScreen.tsx"
  "client/screens/VehicleDetailScreen.tsx"
)

TAGS_REGEX='<(Pressable|TouchableOpacity|Button|FAB|TextInput|Input|Card)([ \t]|$)'

failures=0

for file in "${SCREENS[@]}"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi
  awk -v TAGS="$TAGS_REGEX" '
    function strip(line,    s) {
      s = line
      gsub(/=>/, "  ", s)
      gsub(/\/>/, "  ", s)
      return s
    }
    function has_close(line) { return (strip(line) ~ />/) }
    function tag_name(line,    m) {
      if (match(line, /<[A-Za-z]+/)) {
        m = substr(line, RSTART + 1, RLENGTH - 1)
        return m
      }
      return ""
    }
    function check(b, file, lineno, name,    has_label, has_test, interactive) {
      has_label = (b ~ /accessibilityLabel/)
      has_test  = (b ~ /testID/)
      # Card is a container that is only interactive when given onPress; only
      # require a11y metadata in that case. All other tags are always interactive.
      interactive = (name == "Card") ? (b ~ /onPress/) : 1
      if (!interactive) return
      if (!has_label) {
        printf("%s:%d: <%s> missing accessibilityLabel\n", file, lineno, name)
        any_missing = 1
      }
      if (!has_test) {
        printf("%s:%d: <%s> missing testID\n", file, lineno, name)
        any_missing = 1
      }
    }
    BEGIN { open = 0; buf = ""; start_line = 0; tag = ""; any_missing = 0 }
    {
      if (open == 0) {
        if (match($0, TAGS)) {
          tag = tag_name($0)
          start_line = NR
          buf = $0
          if (has_close($0)) {
            # Capture children on the same line for Button label heuristic.
            check(buf, FILENAME, start_line, tag)
            buf = ""
            tag = ""
          } else {
            open = 1
          }
        }
      } else {
        buf = buf "\n" $0
        if (has_close($0)) {
          # Try to also peek at the next line as children for Button heuristic.
          open = 0
          check(buf, FILENAME, start_line, tag)
          buf = ""
          tag = ""
        }
      }
    }
    END { exit (any_missing ? 1 : 0) }
  ' "$file" || failures=$((failures + 1))
done

if [[ $failures -gt 0 ]]; then
  echo ""
  echo "[check-a11y] $failures file(s) have interactive elements missing accessibilityLabel or testID."
  echo "[check-a11y] Convention: every Pressable/TouchableOpacity/Button/FAB/TextInput/Input needs"
  echo "[check-a11y] both an accessibilityLabel and a stable testID ({action}-{target})."
  exit 1
fi

echo "[check-a11y] OK: all in-scope screens look good."
