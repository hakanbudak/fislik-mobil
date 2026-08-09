import { Tabs } from "expo-router";
import { Bell, Receipt, User, Users } from "lucide-react-native";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Client's tab shell. `muhasebecim` arrives in Task 18, `bildirimler` and
 * `profil` in Task 20 — all three are registered now with placeholder
 * screens so expo-router doesn't warn about a tab with no matching route.
 */
export default function ClientTabsLayout() {
  return (
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
        options={{ title: "Bildirimler", tabBarIcon: ({ color, size }) => <Bell color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profil"
        options={{ title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}
