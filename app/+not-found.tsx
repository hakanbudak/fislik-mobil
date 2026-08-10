import { Compass } from "lucide-react-native";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/src/theme/components/Button";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Catch-all for unmatched URLs — expo-router recognizes `+not-found` (unlike
 * `+error`, see `app/_layout.tsx`) and renders this in place of any route it
 * couldn't match, replacing the router's own bare `Unmatched` view
 * (`expo-router/build/views/Unmatched.js`).
 *
 * Copy and layout mirror `fislik-web/src/pages/NotFoundPage.tsx` (same
 * "Sayfa bulunamadı" heading, same explanation, same "Ana sayfaya dön"
 * action), with one deliberate difference: the web page reads `useMe()` to
 * send an accountant to `/muhasebeci` and everyone else to `/`. This screen
 * always goes to `/` (`app/index.tsx`), which already does that same
 * role-based redirect itself — anon to `/giris`, client to `/(client)`,
 * accountant to `/(accountant)` — so re-deriving the role here would just
 * duplicate `Index`'s own logic. It's also the reason there's no bounce
 * risk: `/` never renders `+not-found` itself, so this can't loop.
 */
export default function NotFoundScreen() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Compass size={26} strokeWidth={2} color={tokens.color.primary} />
        </View>
        <Text style={styles.title}>Sayfa bulunamadı</Text>
        <Text style={styles.body}>Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</Text>
        <View style={styles.action}>
          <Button title="Ana sayfaya dön" onPress={() => router.replace("/")} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.page,
    padding: tokens.space(5),
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: tokens.space(3),
    padding: tokens.space(6),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
  },
  title: { ...text.title, color: tokens.color.ink, textAlign: "center" },
  body: { ...text.body, color: tokens.color.inkSoft, textAlign: "center" },
  action: { width: "100%", marginTop: tokens.space(2) },
});
