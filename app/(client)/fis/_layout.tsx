import { Stack } from "expo-router";

/**
 * Puts the client's receipt-detail route behind a `Stack` instead of leaving
 * `fis/[id]` hoisted straight into `(client)/_layout.tsx`'s tab navigator.
 *
 * A tab screen is one persistent instance: react-navigation keeps it mounted
 * and, on a second navigation to the same route name, updates its params in
 * place rather than mounting a fresh screen. The route params therefore *do*
 * refresh (`useLocalSearchParams().id` becomes the newly tapped receipt), but
 * nothing below re-mounts — so every piece of per-receipt component state
 * seeded once at mount kept the *previous* receipt's values:
 * `ExtractionEditor`'s `draft` (lazily seeded via `buildDraft(extraction)`),
 * this screen's `issueResolved` / `confirmingDelete` / `changingPeriod` /
 * `tempPeriod`. The screen then read as "the receipt I tapped last time",
 * and — because the mutations target the *new* `id` while the form still
 * holds the *old* receipt's values — pressing "Kaydet" would write one
 * receipt's extraction onto another.
 *
 * Inside a `Stack`, each `router.push` mounts a new screen with its own
 * params and its own fresh state, and `router.back()` pops to the previous
 * receipt rather than straight out to the list. Headerless because the
 * screen draws its own back row; the tab bar stays visible because this
 * stack is nested *inside* the tab navigator's `fis` screen.
 */
export default function ClientReceiptStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
