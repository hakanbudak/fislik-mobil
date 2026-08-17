import { Stack } from "expo-router";

/**
 * The "Mükellefler" tab is a `Stack` ROOTED AT THE CLIENT LIST, carrying the
 * whole per-client subtree above it: the month screen (`mukellef/[clientId]`),
 * its camera and the receipt detail. Back therefore steps
 * receipt -> month -> client list, one screen at a time.
 *
 * See `app/(client)/(fisler)/_layout.tsx` for the two bugs this shape fixes —
 * the same two apply here. In short: without a stack these were flat tab
 * screens that never re-mounted, so a second receipt rendered with the
 * first's editor draft while the mutations targeted the second's id; and with
 * a stack under a separate, list-less tab, backing out of a month never
 * popped it, so opening a second client landed on the first one's month
 * instead of the client list.
 *
 * Headerless — every screen underneath draws its own back row — and nested
 * inside the tab navigator, so the tab bar and `AppHeader` stay visible.
 */
export default function AccountantClientsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
