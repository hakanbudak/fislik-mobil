import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";
import { Button } from "@/src/theme/components/Button";
import { useAuth } from "./AuthProvider";

/**
 * Shown when `status === "locked"` — the stored token is still valid, the
 * user just hasn't passed the biometric prompt they opted into. `Kilidi aç`
 * retries the prompt; `Çıkış yap` is the escape hatch for a user who can no
 * longer pass biometrics (device damage, hand injury, etc.) so they are
 * never permanently stuck outside an app they are otherwise authorised to
 * use.
 */
export function LockedScreen() {
  const { retryUnlock, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <View style={styles.page}>
      <Text style={[text.title, styles.mark]}>Fişlik</Text>
      <Text style={[text.body, styles.description]}>Devam etmek için kilidi açın.</Text>
      <View style={styles.actions}>
        <Button
          title="Kilidi aç"
          loading={retrying}
          busyTitle="Açılıyor…"
          onPress={async () => {
            setRetrying(true);
            await retryUnlock();
            setRetrying(false);
          }}
        />
        <Button
          title="Çıkış yap"
          variant="secondary"
          loading={signingOut}
          busyTitle="Çıkış yapılıyor…"
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
    paddingHorizontal: tokens.space(5),
    gap: tokens.space(4),
  },
  mark: { color: tokens.color.primary, textAlign: "center" },
  description: { color: tokens.color.inkSoft, textAlign: "center" },
  actions: { width: "100%", gap: tokens.space(2) },
});
