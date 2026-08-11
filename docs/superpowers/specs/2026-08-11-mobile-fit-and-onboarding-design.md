# Mobile fit and onboarding — Design

**Date:** 2026-08-11
**Status:** Approved

## Why

The app was built and reviewed without a device in the loop. The first run on a
real phone surfaced problems no test could reach, plus two gaps the spec never
covered.

Reported by the user, then reproduced from a screenshot and confirmed in code:

- The top of every screen is hidden behind the status bar and Dynamic Island.
- The bottom tab bar is cramped, with truncated labels.
- The app "doesn't look like it was made for a phone".
- There is no introduction — the app opens straight onto the login form.
- There is no explanation of how to use it.

## What was actually wrong

**Six routes leak into the tab bars.** `app/(client)/` holds seven route files
but registers four `Tabs.Screen`s, so `kamera`, `firma-bilgileri` and `fis/[id]`
render as tabs with placeholder chevron icons. Seven items in a bar designed for
four is why the labels truncate to `Muhas…` and `Bildiri…`. No `href: null`
appears anywhere in the app.

The accountant shell has the same defect from its unregistered `mukellef/*`
routes, though how many entries a nested route directory produces has not been
observed — that role was never opened on a device. The implementation must check
rather than assume, and hide whatever appears.

**Safe-area handling does not exist.** `react-native-safe-area-context` is a
dependency, but `SafeAreaProvider`, `SafeAreaView` and `useSafeAreaInsets` are
used in exactly zero files. The root layout wraps `QueryClientProvider →
AuthProvider → Slot` and nothing else, so no screen can reach the device's
insets. Content starts at pixel zero and the tab bar ends at the last pixel.

**`GestureHandlerRootView` is missing.** Not reported, but the same class of
omission: without it, `react-native-gesture-handler` does not receive events on
Android, so the receipt viewer's pinch-to-zoom is silently dead there.

**Polish gaps** found by audit: touch targets below the 44pt minimum (month
picker chevrons and camera controls at 32×32), the camera FAB covering the last
receipt card because the list's bottom padding does not account for it, an
unmanaged status bar style, and one fixed `108pt` width in `ExtractionEditor`
that can overflow a 375pt screen.

## Approach

Fix the foundation, and derive the shell from the web's existing narrow-screen
layout rather than inventing one. The user named that layout as the target, and
it lives in `fislik-web/src/components/ClientShell.tsx` — so "better" is a
measurable goal instead of a matter of taste.

A full mobile redesign was considered and rejected: it would discard the
screen-by-screen parity that 29 tasks established, and replace a bounded problem
with an open-ended one.

## The shell

**Header, 56pt.** `FislikMark` at 22×31 beside the word "Fişlik" at 19px bold
with -1px tracking, matching the web.

**Deliberate divergence:** the web also puts a notification button in this
header, duplicating its own bottom-nav entry. Mobile drops it. Two routes to the
same destination is not worth the vertical space on a phone, and the tab bar
already carries the unread badge.

**Bottom navigation.** Top border, `card` background, `10pt` horizontal and
`6pt` top padding, and `10pt` plus the bottom safe-area inset below. Inside, a
centred row capped at 460pt holding four equal items: a 21px icon at stroke
width 1.9 above a 10px bold label, `primary` when active and `inkSoft`
otherwise.

## Safe-area foundation

`GestureHandlerRootView` wraps `SafeAreaProvider`, which wraps the existing
provider stack in `app/_layout.tsx`. The header consumes the top inset and the
tab bar consumes the bottom one, so individual screens never handle insets
themselves — a screen that forgets is then impossible rather than merely
unlucky.

The six leaked routes are hidden with `href: null`. They remain reachable by
navigation; they simply stop being tabs.

## Polish

Touch targets grow to 44×44 through hit slop, leaving the visual size unchanged
— the month picker chevrons and camera controls are the ones users will miss
today. List bottom padding accounts for the FAB's height plus the safe-area
inset, so the last card is never covered. The status bar is set explicitly for a
light background. `ExtractionEditor`'s fixed 108pt width becomes flexible.

## Introduction

Four swipeable screens on first launch, before login: **photograph your
receipt** → **send it to your accountant** → **follow its status** → **it works
without a connection**.

The fourth earns its place. The offline queue is the app's most distinctive
behaviour and its most defensive one; a user who does not know it exists will
assume a capture taken with no signal was lost.

Every screen offers "Geç". Completion or skip writes a flag to AsyncStorage and
the tour never appears again, but it stays reachable from the help page.

## Help

One page under Profil whose content follows `user.role`.

For a taxpayer: photographing receipts, choosing a month, sending the month to
the accountant, and what to do when an issue is reported. For an accountant:
inviting a taxpayer, marking receipts processed, closing a month, and exporting
the archive. Both end with a link back to the introduction.

## Testing

Most of this work is visual and can only be judged on a device, so device
verification is the acceptance gate, not the test suite.

What the suite can still pin: that no leaked route appears as a tab, that the
introduction does not show on a second launch, that the help page renders the
content matching the signed-in role, and that the safe-area and gesture-handler
providers are mounted.

## Out of scope

Redesigning individual screens' spacing, typography or density. Any change to
the web app. Push notifications, dark theme and tablet layouts remain out of
scope as in the original spec.
