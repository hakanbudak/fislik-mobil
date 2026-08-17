import { Stack } from "expo-router";

/**
 * The "Fişler" tab is a `Stack` ROOTED AT THE LIST, with the receipt-detail
 * route pushed on top of it — not a bare list screen, and not a stack living
 * under a tab of its own.
 *
 * Both details matter, and each fixes a different bug:
 *
 * 1. A `Stack` at all, rather than `fis/[id]` hoisted into the tab navigator
 *    as its own flat screen. A tab screen is one persistent instance:
 *    react-navigation updates its params in place on a repeat navigation but
 *    never re-mounts it, so every piece of per-receipt state seeded at mount
 *    kept the PREVIOUS receipt's values — `ExtractionEditor`'s `draft` above
 *    all, which made "Kaydet" write one receipt's extraction onto another,
 *    unrecoverably. Inside a stack, each push mounts a fresh screen.
 *
 * 2. Rooted at the list, rather than a `fis/` stack under a separate,
 *    list-less tab. That arrangement fixed (1) but broke back navigation: a
 *    nested stack cannot hold zero screens, so `router.back()` from its only
 *    entry delegated to the tab navigator and returned to the list tab
 *    WITHOUT popping the receipt. The next tap pushed on top of the one left
 *    behind, and back from it landed on the previously-viewed receipt instead
 *    of the list. Rooting the stack at the list means opening a receipt never
 *    leaves this tab, so back is an ordinary pop and the stack never grows
 *    past [list, receipt].
 *
 * `popToTopOnBlur` cannot substitute for (2) — it pops a blurred tab's stack
 * to its FIRST screen, which in the list-less arrangement was itself a
 * receipt. Neither can `Stack.Screen`'s `dangerouslySingular`: it filters
 * history only for navigation issued within the stack, and these pushes came
 * from another tab. Both were measured, not assumed.
 *
 * Headerless because the list and the detail screen each draw their own
 * chrome; the tab bar and `AppHeader` stay visible because this stack is
 * nested inside the tab navigator's `(fisler)` screen.
 */
export default function ClientReceiptsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
