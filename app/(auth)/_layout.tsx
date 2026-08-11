import { Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/src/theme/tokens";

/**
 * Unauthenticated group: login, register, both password-reset steps, the
 * invite-acceptance screen and the first-launch tour. Each screen builds its
 * own chrome via `AuthShell` (or, for `tanitim`, its own full-page layout),
 * so the stack itself is headerless — but nothing below this layout reads
 * `useSafeAreaInsets()` itself, so the outer `View` here carries top and
 * bottom padding, the same shape as the two tab shells
 * (`app/(client)/_layout.tsx`, `app/(accountant)/_layout.tsx`). Without it,
 * `tanitim`'s action row sits on the home indicator and `kayit`'s content —
 * which is taller than the screen — scrolls under the Dynamic Island.
 */
export default function AuthLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: tokens.color.surface }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
