import { StyleSheet, Text, View } from "react-native";
import { FislikMark } from "./FislikMark";
import { tokens } from "../tokens";
import { font } from "../typography";

/**
 * The 56pt brand row above both tab shells, ported from the web's
 * narrow-screen header (`fislik-web/src/components/ClientShell.tsx` /
 * `AccountantShell.tsx`'s `<header className="flex h-14 ... px-4 wide:hidden">`).
 *
 * Unlike the web, this component carries no top-safe-area-inset logic of its
 * own: the shell's outer `View` in each `_layout.tsx` pads for `insets.top`
 * so that whichever element is topmost on screen — the impersonation banner
 * when active, this header otherwise — clears the status bar/Dynamic Island.
 * Keeping the inset here too would double-pad when the banner isn't shown
 * and, worse, leave the banner itself flush against the status bar when it
 * is — the exact bug this component exists to avoid.
 *
 * Deliberately drops the web's notification button (`<Bell>` linking to
 * `/bildirimler`) — the tab bar already carries the unread badge via
 * `NotificationTabIcon`, so a second route to the same destination isn't
 * worth the vertical space on a phone.
 */
export function AppHeader() {
  return (
    <View style={styles.header}>
      <FislikMark width={22} height={31} />
      <Text style={styles.wordmark}>Fişlik</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(2),
    paddingHorizontal: tokens.space(4),
    height: 56,
    backgroundColor: tokens.color.card,
  },
  wordmark: {
    fontFamily: font.bold,
    fontSize: 19,
    letterSpacing: -1,
    color: tokens.color.ink,
  },
});
