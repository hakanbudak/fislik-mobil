# Follow-ups

Work deliberately left out of the initial build, triaged at the final
whole-branch review. Everything here is a decision that was made, not something
that was forgotten.

## Fix soon

**No server-side token revocation.** `/auth/logout` only clears the API's
cookie, and `jwt_expires_days` is 7, so a token handed to a native client stays
valid for up to a week after sign-out. This gap predates the mobile app, but its
blast radius is larger here: the token lives in Keychain/Keystore on a device
that can be lost, rather than only in an HttpOnly cookie. Options are a shorter
expiry, a denylist, or refresh tokens. Lives in fislik-api.

**`access_token` in the login/register response body.** Adding it for native
clients means the web's session token is now readable by page JavaScript at
login time, where it previously existed only in an HttpOnly cookie. Narrow — it
is only that one response, the web never stores it, and exploiting it needs an
existing XSS — but it is a real reduction in defence in depth. Could be gated on
a client hint so only the mobile app receives it.

**The optimistic `issueResolved` flag hides a reopened issue.** Ported from the
web: after a client resolves an issue, a local flag suppresses the card until
the next real refetch. If the accountant opens a *new* issue on the same receipt
while that screen stays mounted, the client will not see it. More reachable on
mobile than on the web, where sessions rarely sit on one screen for hours.
Keying the optimism to the issue id rather than a boolean would fix it.

**Confirm the API's role enum.** `Role` is hand-declared as
`"client" | "accountant"` in `src/api/endpoints.ts` because the generated schema
types `role` as a bare `string`. `RegisterIn.role` is genuinely
`Literal["client", "accountant"]` today, so signup is safe, but `UserOut.role`
is unconstrained — a third role appearing in output would be missed. Tightening
the OpenAPI schema would let the type be generated instead.

**A locked-month upload is re-filed silently.** The API moves a receipt aimed at
a locked month into the next open month, and both months refresh so the result
is *visible* — but nothing tells the user it happened. A toast naming the month
it landed in would close the gap.

**`MonthPicker`'s next-month rule is untested.** It disables the next-month
control beyond the current month; nothing pins that.

**A first-time accountant sees the taxpayer's introduction.** The tour runs
before login, where the role is unknown, and its four slides are taxpayer-framed
by design ("send it to your accountant"). The help page no longer offers the
replay to accountants, but the pre-login showing is unavoidable while the tour
stays where it is. The route `/(auth)/tanitim` also carries no role check, so an
accountant reaching it by deep link sees the same copy. Options: move the tour
after login, add a role question to the first slide, or accept it. Needs a
product decision, not a code fix.

## Accepted, no action planned

**404 detection by message matching in `downloadMonthZip`.** No download
primitive in expo-file-system 57 exposes a numeric HTTP status — verified in the
iOS Swift and Android Kotlin sources; the structured-status behaviour is
upload-only. The rejection message carrying the status code is the SDK's
documented contract, the reasoning is in the module docstring, and the tests pin
real native message strings from both platforms.

**Queue ids are `Date.now()` plus randomness, not UUIDs.** Local-only and
collision-improbable.

**The route-registry test deep-imports `expo-router/build/getRoutes`.**
`src/test/expoRouterRegistry.ts` reads the real route directories and runs
expo-router's own route generation, which is what makes the tab-leak test able
to fail. The cost is a dependency on a non-public path that an expo-router
upgrade may move. The failure would be loud, not silent, and the alternative is
a test that agrees with itself.

**A phantom `Tabs.Screen` naming no real route is not caught.** The layout tests
walk the registered routes checking each has a screen, never the reverse. The
bug it would miss is inert — a screen config matching nothing does nothing.

**The tab bar uses a solid `card` background where the web uses `bg-card/95`.**
No translucent token exists, and a raw literal would break the no-literals rule.
Adding the token is the fix if it ever matters visually.

**Both tab shells duplicate ~25 lines of `screenOptions` verbatim** and nothing
pins them equal, so the two bars can drift apart silently.

**`UNSAFE_getByProps` in one test.** It reaches `handleSave`'s guard past
RNTL's disabled-press swallowing. If a future RNTL version breaks it, extract
the emptiness rule into a pure function rather than deleting the test.

**Cosmetic divergences from the web**, each recorded where it was made: the
sign-out button's filled-red variant, `GrantCard` saying `Erişimi iptal et` for
a pending invitation, the accountant's inline invite form instead of a modal,
`FislikMark` on all four auth screens, and the analysis badge's placement.

**A crash inside the crash screen** falls through to React Native's default
error UI. There is one boundary; a second one guarding the first would have the
same problem one level up.

**Resolving an issue cannot clear the accountant's badge** until their screen
refetches. There is no push channel, and they do receive an `issue_resolved`
notification.

## Before store submission

Not code — these need a human:

- On-device QA of the icon through the real OS masks.
- Store listing assets: screenshots, feature graphic, privacy policy URL.
- EAS submit credentials and project linking.
- Optional: an Android 13+ monochrome icon.
- `apple-app-site-association` and `assetlinks.json` served from fislik-web, so
  deep links open the app rather than falling back to the web.
- The manual pass in `docs/manual-test-checklist.md`, which covers everything
  the test suite cannot reach.
- **`eas build --platform android`.** The splash's `imageWidth` must keep the
  Android density arithmetic integral, and this machine has no `sharp`, so
  `expo prebuild` here takes a tolerant path that a real build image does not.
  A wrong value fails resource linking at build time and nowhere earlier.
- **The launch splash on a real cold start**, both platforms: the teal handover
  with no icon flash on Android 12+, the print motion, the exit fade, and the
  OS "Reduce Motion" toggle. Nothing about a cold start is exercisable in Jest.
- **The intro tour's card layout on a device**: vertical centring, the zigzag
  edges and their shadow, the snap-and-peek feel, and — because RNTL's
  `fireEvent` bypasses hit-testing entirely — that a real finger on a progress
  dot selects the dot it is over. That last one shipped a wrong-slide bug once.
- **The mark's drop shadow is clipped at rest on both platforms.** The design's
  own values make it impossible: a 192pt print window holding a 181pt mark
  leaves 11pt, and the specified shadow needs 28pt. Raise with the designer
  rather than contorting the layout.
