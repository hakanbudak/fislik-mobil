import { Tabs } from "expo-router";
import { Receipt, User, Users } from "lucide-react-native";
import { ImpersonationBanner } from "@/src/auth/ImpersonationBanner";
import { NotificationTabIcon } from "@/src/features/notifications/NotificationTabIcon";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Client's tab shell. `muhasebecim` arrives in Task 18, `bildirimler` and
 * `profil` in Task 20 — all three are registered now with placeholder
 * screens so expo-router doesn't warn about a tab with no matching route.
 *
 * `<ImpersonationBanner />` sits above the tabs so it's visible regardless
 * of which tab is active, same placement as the web's shell-level mount.
 */
export default function ClientTabsLayout() {
  return (
    <>
      <ImpersonationBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tokens.color.primary,
          tabBarInactiveTintColor: tokens.color.inkSoft,
          tabBarStyle: { backgroundColor: tokens.color.card },
          tabBarLabelStyle: text.caption,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Fişler", tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="muhasebecim"
          options={{
            title: "Muhasebecim",
            tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="bildirimler"
          options={{
            title: "Bildirimler",
            tabBarIcon: ({ color, size }) => <NotificationTabIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profil"
          options={{ title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
        />
      </Tabs>
    </>
  );
}
