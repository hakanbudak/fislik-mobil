import { Stack } from "expo-router";

/**
 * The accountant's per-client subtree — the month screen
 * (`[clientId]`), its camera (`[clientId]/kamera`) and the receipt detail
 * (`[clientId]/fis/[id]`) — behind a `Stack`.
 *
 * Without this file expo-router hoisted all three straight into
 * `(accountant)/_layout.tsx`'s tab navigator, so each was a single
 * persistent tab instance that never re-mounted. See
 * `app/(client)/fis/_layout.tsx` for the full failure mode: params refresh
 * on a repeat navigation, component state does not, so a second receipt
 * rendered with the first one's `ExtractionEditor` draft while the
 * mutations pointed at the second one's id.
 *
 * It also restores real back navigation: month -> receipt -> back now pops
 * to the month screen it was pushed from, and the three routes collapse into
 * a single `mukellef` entry in the tab navigator instead of three.
 *
 * Headerless — every screen underneath draws its own back row — and nested
 * inside the tab navigator, so the tab bar stays visible throughout.
 */
export default function AccountantClientStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
