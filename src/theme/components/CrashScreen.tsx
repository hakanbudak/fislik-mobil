import { TriangleAlert } from "lucide-react-native";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import { tokens } from "../tokens";
import { text } from "../typography";
import { Button } from "./Button";

/**
 * Last-resort screen for `app/_layout.tsx`'s `ErrorBoundary` export — the
 * one thing rendered when everything else in the tree has already thrown.
 * Deliberately built from nothing but plain React Native primitives, theme
 * tokens/typography and `Button` (itself token-only): no `useAuth()`, no
 * query hooks, no upload-queue reads. Any of those could be the very thing
 * that crashed, and a boundary that depends on broken state can black-screen
 * instead of recovering.
 *
 * The message shown is deliberately NOT the raw `error.message`: for an
 * `ApiError` that string IS `error.detail` — a backend-authored string the
 * app-wide rule (see `src/lib/errors.ts`) says must never reach the UI — and
 * for an ordinary JS crash it's developer text a Turkish-speaking taxpayer
 * can't act on. Instead a fixed, reassuring sentence is always shown, and
 * the real message is added underneath in muted caption style — but only
 * when it is safe: never for `ApiError` (its message is exactly the
 * forbidden `.detail`), always for anything else, since a raw RN/JS message
 * ("undefined is not an object") isn't sensitive and gives a user something
 * concrete to relay if they contact support.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => void }) {
  const showTechnicalDetail = !(error instanceof ApiError);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <TriangleAlert size={26} strokeWidth={2} color={tokens.color.danger} />
        </View>
        <Text style={styles.title}>Bir şeyler ters gitti</Text>
        <Text style={styles.body}>
          Beklenmedik bir hata oluştu. Sorun devam ederse uygulamayı yeniden başlatmayı deneyin.
        </Text>
        {showTechnicalDetail ? <Text style={styles.detail}>Teknik detay: {error.message}</Text> : null}
        <View style={styles.actions}>
          <Button title="Tekrar dene" onPress={retry} />
          <Button title="Ana sayfaya dön" variant="secondary" onPress={() => router.replace("/")} />
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
  detail: { ...text.caption, color: tokens.color.inkSoft, textAlign: "center" },
  actions: { width: "100%", gap: tokens.space(2), marginTop: tokens.space(2) },
});
