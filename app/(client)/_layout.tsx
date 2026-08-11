import { Tabs } from "expo-router";
import { Receipt, User, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImpersonationBanner } from "@/src/auth/ImpersonationBanner";
import { NotificationTabIcon } from "@/src/features/notifications/NotificationTabIcon";
import { tokens } from "@/src/theme/tokens";
import { font, text } from "@/src/theme/typography";

/**
 * Client's tab shell. `muhasebecim` arrives in Task 18, `bildirimler` and
 * `profil` in Task 20 — all three are registered now with placeholder
 * screens so expo-router doesn't warn about a tab with no matching route.
 *
 * `<ImpersonationBanner />` sits above the tabs so it's visible regardless
 * of which tab is active, same placement as the web's shell-level mount.
 *
 * `kamera`, `firma-bilgileri` and `fis/[id]` are real routes in this group
 * (reachable via `router.push`) but aren't destinations of their own — they
 * leaked into the bar as untitled placeholder tabs before this fix.
 * `href: null` is expo-router's documented way to keep a route registered
 * (so linking to it still works) while excluding it from the tab bar.
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
  return (
    <>
      <ImpersonationBanner />
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
            height: 56 + insets.bottom,
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
        <Tabs.Screen name="kamera" options={{ href: null }} />
        <Tabs.Screen name="firma-bilgileri" options={{ href: null }} />
        <Tabs.Screen name="fis/[id]" options={{ href: null }} />
      </Tabs>
    </>
  );
}
