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

## Accepted, no action planned

**404 detection by message matching in `downloadMonthZip`.** No download
primitive in expo-file-system 57 exposes a numeric HTTP status — verified in the
iOS Swift and Android Kotlin sources; the structured-status behaviour is
upload-only. The rejection message carrying the status code is the SDK's
documented contract, the reasoning is in the module docstring, and the tests pin
real native message strings from both platforms.

**Queue ids are `Date.now()` plus randomness, not UUIDs.** Local-only and
collision-improbable.

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

## Watch

**Three `waitFor` screen tests** (davet, mukellef, firma-bilgileri) were
reported flaky under parallel workers. Neither the controller (twice) nor two
reviewers could reproduce it. If CI ever flakes there, raise those three
timeouts.

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
