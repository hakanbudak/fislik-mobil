import { Tabs } from "expo-router";
import { User, Users } from "lucide-react-native";
import { ImpersonationBanner } from "@/src/auth/ImpersonationBanner";
import { NotificationTabIcon } from "@/src/features/notifications/NotificationTabIcon";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Accountant's tab shell — same structure as `(client)/_layout.tsx`:
 * `<ImpersonationBanner />` above the tabs so an admin impersonating an
 * accountant sees the warning regardless of which tab is active (Task 20
 * built the banner and mounted it client-side; this file didn't exist yet
 * for the accountant side).
 */
export default function AccountantTabsLayout() {
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
          options={{ title: "Mükellefler", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
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
