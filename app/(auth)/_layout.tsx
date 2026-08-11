import { Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/src/theme/tokens";

/**
 * Unauthenticated group: login, register, both password-reset steps and the
 * invite-acceptance screen. Each screen builds its own chrome via
 * `AuthShell`, so the stack itself is headerless — but nothing below this
 * layout reads `useSafeAreaInsets()` itself, so the outer `View` here
 * carries top and bottom padding, the same shape as the two tab shells
 * (`app/(client)/_layout.tsx`, `app/(accountant)/_layout.tsx`). Without it,
 * `kayit`'s content — which is taller than the screen — scrolls under the
 * Dynamic Island.
 *
 * The post-login tour (`app/tanitim.tsx`) used to live in this group when it
 * ran before login; it moved to the app root once it became role-aware and
 * gated on the authed user, since a route inside this group is by
 * definition reachable while signed out.
 */
export default function AuthLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: tokens.color.surface }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
