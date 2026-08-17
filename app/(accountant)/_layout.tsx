import { Tabs } from "expo-router";
import { User, Users } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "@/src/auth/AuthGate";
import { ImpersonationBanner } from "@/src/auth/ImpersonationBanner";
import { NotificationTabIcon } from "@/src/features/notifications/NotificationTabIcon";
import { AppHeader } from "@/src/theme/components/AppHeader";
import { tokens } from "@/src/theme/tokens";
import { font, text } from "@/src/theme/typography";

/**
 * Accountant's tab shell — same structure as `(client)/_layout.tsx`:
 * `<ImpersonationBanner />` above `<AppHeader />` (which sits above the
 * tabs) so an admin impersonating an accountant sees the warning regardless
 * of which tab is active (Task 20 built the banner and mounted it
 * client-side; this file didn't exist yet for the accountant side). The
 * outer `View` — not `AppHeader` — carries `paddingTop: insets.top`, so
 * whichever element ends up topmost (the banner when impersonating, the
 * header otherwise) clears the status bar/Dynamic Island.
 *
 * The per-client subtree (`mukellef/[clientId]` and everything below it) is
 * reachable but not a tab of its own, so it carries `href: null`. It
 * registers here as a single `mukellef` entry because `mukellef/_layout.tsx`
 * exists: expo-router hoists routes into the nearest ancestor `_layout` (see
 * `getRoutesCore.js`), and that file is now the nearest one, so the subtree
 * stops at it instead of reaching this navigator. That `Stack` is load-bearing
 * — see its docstring for the wrong-receipt bug three flat tab screens caused.
 *
 * `mukellefleri-yonet` is the same story without the hoisting: a real,
 * reachable route (the active-grant management page linked from the
 * Mükellefler screen) that must stay off the tab bar, so it also needs
 * `href: null` — this exact defect (a new route becoming a fourth tab) has
 * already been fixed once on this branch and must not recur.
 *
 * Bar styling matches `(client)/_layout.tsx`'s, ported from the same web
 * source (`fislik-web/src/components/AccountantShell.tsx`'s narrow-screen
 * bottom nav, identical markup/classes to `ClientShell.tsx`'s).
 */
export default function AccountantTabsLayout() {
  const insets = useSafeAreaInsets();
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
              height: 56 + insets.bottom,
            },
            tabBarLabelStyle: { ...text.caption, fontFamily: font.bold, fontSize: 10 },
            tabBarIconStyle: { marginBottom: 0 },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Mükellefler",
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
          <Tabs.Screen name="mukellef" options={{ href: null }} />
          <Tabs.Screen name="mukellefleri-yonet" options={{ href: null }} />
          <Tabs.Screen name="yardim" options={{ href: null }} />
        </Tabs>
      </View>
    </AuthGate>
  );
}
