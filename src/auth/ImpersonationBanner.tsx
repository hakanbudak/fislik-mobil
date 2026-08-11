import { ShieldAlert } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@/src/theme/tokens";
import { font, text } from "@/src/theme/typography";
import { useAuth } from "./AuthProvider";

/**
 * Amber strip rendered while an admin is impersonating this account
 * (`user.impersonated`, stamped by the API's admin impersonation endpoint).
 * Mirrors `fislik-web/src/components/ImpersonationBanner.tsx`'s copy and
 * warning styling, with one deliberate mobile adaptation: the web's "Oturumu
 * bitir" button clears the product cookie and then hard-navigates to the
 * admin panel's user list — a destination that only exists on the web host.
 * Mobile has no admin UI to return to, so ending the session here just
 * calls the normal `signOut()` and lets the usual anon redirect (`app/index.tsx`)
 * take over, landing on `/giris`.
 */
export function ImpersonationBanner() {
  const { user, signOut } = useAuth();
  if (!user?.impersonated) return null;

  return (
    <View style={styles.banner}>
      <ShieldAlert size={14} color={tokens.color.onPrimary} strokeWidth={2.4} />
      <Text style={[text.caption, styles.message]} numberOfLines={1}>
        Yönetici olarak <Text style={styles.bold}>{user.full_name}</Text> hesabındasınız
      </Text>
      <Pressable onPress={() => void signOut()} hitSlop={8}>
        <Text style={[text.caption, styles.action]}>Oturumu bitir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space(2),
    backgroundColor: tokens.color.warning,
    paddingHorizontal: tokens.space(3),
    paddingVertical: tokens.space(1.5),
  },
  message: { flexShrink: 1, color: tokens.color.onPrimary },
  bold: { fontFamily: font.bold },
  action: { color: tokens.color.onPrimary, textDecorationLine: "underline" },
});
