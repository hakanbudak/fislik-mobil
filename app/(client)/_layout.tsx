import { router, Tabs } from "expo-router";
import { Camera, Receipt, User, Users } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "@/src/auth/AuthGate";
import { ImpersonationBanner } from "@/src/auth/ImpersonationBanner";
import { NotificationTabIcon } from "@/src/features/notifications/NotificationTabIcon";
import { AppHeader } from "@/src/theme/components/AppHeader";
import { tokens } from "@/src/theme/tokens";
import { font, text } from "@/src/theme/typography";

/** Diameter of the raised camera button, matching the FAB it replaces. */
const CAMERA_BUTTON_SIZE = 56;

/**
 * Client's tab shell. `muhasebecim` arrives in Task 18, `bildirimler` and
 * `profil` in Task 20 — all three are registered now with placeholder
 * screens so expo-router doesn't warn about a tab with no matching route.
 *
 * `<ImpersonationBanner />` sits above `<AppHeader />` (which sits above the
 * tabs) so a warning stays the topmost thing on screen regardless of which
 * tab is active, same placement as the web's shell-level mount. The outer
 * `View` — not `AppHeader` — carries `paddingTop: insets.top`, so whichever
 * element ends up topmost (the banner when impersonating, the header
 * otherwise) clears the status bar/Dynamic Island.
 *
 * `firma-bilgileri`, `fis` and `yardim` are real routes in this group
 * (reachable via `router.push`) but aren't destinations of their own — they
 * leaked into the bar as untitled placeholder tabs before this fix.
 * `href: null` is expo-router's documented way to keep a route registered
 * (so linking to it still works) while excluding it from the tab bar.
 *
 * `fis` is the whole receipt-detail subtree, not a single screen: it has its
 * own `fis/_layout.tsx` (a `Stack`), so expo-router registers one `fis`
 * entry here instead of hoisting `fis/[id]` in as a flat tab. That nesting
 * is load-bearing, not cosmetic — see that file for the wrong-receipt bug a
 * flat tab caused.
 *
 * `kamera` is registered as the middle (third) tab so the bar has five equal
 * slots and the raised camera button sits over the true centre one. Its
 * `tabBarButton` renders an empty, non-interactive `View` — the bar reserves
 * centred space for it and shows no icon or label there. The actual button
 * is a separate, absolutely-positioned sibling of `<Tabs>` below (see
 * `cameraButtonOffset`) rather than a child of the tab bar itself: on
 * Android, a view rendered outside its parent's bounds doesn't receive touch
 * events even with `overflow` styling, so a bar-child translated upward
 * would show its protruding top half but not accept touches there. As a
 * child of the shell `View` instead, its full circle is tappable on both
 * platforms.
 *
 * Bar styling below is ported from the web's narrow-screen bottom nav
 * (`fislik-web/src/components/ClientShell.tsx`'s `<nav className="... px-2.5
 * pb-2.5 pt-1.5 ...">`, `text-[10px] font-bold` labels, 21px/1.9 stroke
 * icons): `paddingTop`/`paddingBottom` mirror its `pt-1.5`/`pb-2.5` (space(1.5)
 * = 6, space(2.5) = 10), with the safe-area bottom inset added on top of the
 * web's fixed padding so labels never sit on the home-indicator bar.
 */
export default function ClientTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  // Distance from the shell's bottom edge to the button's bottom edge, so
  // the button's vertical centre lands exactly on the bar's top edge —
  // "half inside the bar, half outside it" — for any device's inset.
  const cameraButtonOffset = tabBarHeight - CAMERA_BUTTON_SIZE / 2;
  return (
    <AuthGate>
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: tokens.color.card }}>
        <ImpersonationBanner />
        <AppHeader />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: tokens.color.primary,
            tabBarInactiveTintColor: tokens.color.inkSoft,
            tabBarStyle: {
              backgroundColor: tokens.color.card,
              borderTopColor: tokens.color.border,
              borderTopWidth: 1,
              paddingTop: tokens.space(1.5),
              paddingBottom: tokens.space(2.5) + insets.bottom,
              height: tabBarHeight,
            },
            tabBarLabelStyle: { ...text.caption, fontFamily: font.bold, fontSize: 10 },
            tabBarIconStyle: { marginBottom: 0 },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Fişler",
              tabBarIcon: ({ color }) => <Receipt color={color} size={21} strokeWidth={1.9} />,
            }}
          />
          <Tabs.Screen
            name="muhasebecim"
            options={{
              title: "Muhasebecim",
              tabBarIcon: ({ color }) => <Users color={color} size={21} strokeWidth={1.9} />,
            }}
          />
          <Tabs.Screen
            name="kamera"
            options={{
              // Reserves centred space in the bar; the real, tappable button
              // is rendered as an overlay below, not as this tab's button.
              tabBarButton: () => <View style={{ flex: 1 }} />,
            }}
          />
          <Tabs.Screen
            name="bildirimler"
            options={{
              title: "Bildirimler",
              tabBarIcon: ({ color }) => <NotificationTabIcon color={color} size={21} />,
            }}
          />
          <Tabs.Screen
            name="profil"
            options={{
              title: "Profil",
              tabBarIcon: ({ color }) => <User color={color} size={21} strokeWidth={1.9} />,
            }}
          />
          <Tabs.Screen name="firma-bilgileri" options={{ href: null }} />
          <Tabs.Screen name="fis" options={{ href: null }} />
          <Tabs.Screen name="yardim" options={{ href: null }} />
        </Tabs>
        <View
          testID="camera-button-overlay"
          pointerEvents="box-none"
          style={{ position: "absolute", left: 0, right: 0, bottom: cameraButtonOffset, alignItems: "center" }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fiş çek"
            style={styles.cameraButton}
            onPress={() => router.push("/(client)/kamera")}
          >
            <Camera color={tokens.color.onPrimary} size={24} />
          </Pressable>
        </View>
      </View>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  cameraButton: {
    width: CAMERA_BUTTON_SIZE,
    height: CAMERA_BUTTON_SIZE,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.color.ink,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
