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
/**
 * Puts the client list beneath a month or receipt opened by DEEP LINK (a
 * notification tap, or a cold start straight onto the URL), rather than
 * leaving it as the only screen in the stack — without it `canGoBack()` is
 * `false` there and every back affordance is dead. See
 * `app/(client)/(fisler)/_layout.tsx`.
 *
 * A stack has one anchor, so a deep-linked RECEIPT backs out to the client
 * list rather than to its month: the month was never visited, so there is no
 * month to return to. Reached the ordinary way (list -> month -> receipt) the
 * full chain is intact, since each step is a real push.
 */
export const unstable_settings = { initialRouteName: "index" };

export default function AccountantClientsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
