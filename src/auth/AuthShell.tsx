import type { ReactNode } from "react";
import { Link } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Shared chrome for the four unauthenticated screens (login, register, both
 * password-reset steps): the Fişlik mark, a centered card area for the
 * screen's own form, and a "Kayıt / Giriş" segmented strip pinned below —
 * mirrors `fislik-web/src/pages/AuthShell.tsx`.
 *
 * Deliberately takes `active` instead of reading the route via
 * `usePathname()`: every screen already knows which tab it is, and every
 * screen's test mocks `expo-router` down to just `{ Link, router }` (see
 * `app/(auth)/__tests__/giris.test.tsx`), so this component must not depend
 * on any other expo-router export.
 */
const TABS = [
  { href: "/kayit", label: "Kayıt" },
  { href: "/giris", label: "Giriş" },
] as const;

export function AuthShell({
  children,
  active,
}: {
  children: ReactNode;
  active?: "kayit" | "giris";
}) {
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[text.title, styles.mark]}>Fişlik</Text>
        {children}
        <View style={styles.tabStrip}>
          {TABS.map((tab) => {
            const isActive = tab.href === `/${active}`;
            return (
              <View key={tab.href} style={[styles.tab, isActive && styles.tabActive]}>
                <Link href={tab.href}>
                  <Text style={[text.label, styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                </Link>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.surface },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: tokens.space(4),
    paddingHorizontal: tokens.space(5),
    paddingVertical: tokens.space(7),
  },
  mark: { color: tokens.color.primary, textAlign: "center" },
  tabStrip: {
    flexDirection: "row",
    gap: tokens.space(1),
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    padding: tokens.space(1),
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: tokens.color.card },
  tabLabel: { color: tokens.color.inkSoft, textAlign: "center" },
  tabLabelActive: { color: tokens.color.ink },
});
