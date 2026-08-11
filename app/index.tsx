import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthProvider";
import { LockedScreen } from "@/src/auth/LockedScreen";
import { hasSeenIntro } from "@/src/onboarding/introSeen";
import { Spinner } from "@/src/theme/components/Spinner";

/**
 * Role-based landing redirect: anon -> `/giris` (the tour is no longer
 * reachable while signed out — see `app/tanitim.tsx`'s own guard), an
 * authed user who hasn't seen the post-login tour -> `/tanitim`, an authed
 * user who has -> their role shell, locked (opted into biometric unlock but
 * not yet unlocked) -> the locked screen instead of any redirect.
 *
 * `hasSeenIntro()` is async, so an authed session can't be redirected on
 * first render — `introSeen` holds `undefined` until the read resolves and
 * a `Spinner` renders meanwhile, the same pattern used for
 * `status === "loading"`. Only consulted for `authed`: an anon visitor
 * always goes straight to `/giris`, full stop — there is no flag to check
 * for someone who isn't signed in, since the tour is role-aware and the
 * role is unknown before login.
 *
 * This is the app's only entry point, so a rejected read must fail open:
 * the `.catch` below treats an unreadable flag as "seen" and sends the
 * user to their role shell. Wrongly skipping the tour costs a user a
 * four-slide introduction they can still reach from the help page; wrongly
 * blocking here — the alternative of leaving `introSeen` unset — leaves the
 * `Spinner` mounted forever with no way to reach the app at all. Deliberately
 * handled here rather than inside `hasSeenIntro()`: that function's
 * contract is to report actual storage state, and this fail-open policy is
 * specific to this route's stakes as the sole gate into the app, not a
 * property every caller of the flag should inherit.
 *
 * A rejection isn't the only way this read can fail to deliver, though: it
 * can also simply never settle — no resolve, no reject, ever (a hung
 * AsyncStorage backend, say). `.catch` alone does nothing for that case,
 * and `introSeen` would then stay `undefined` forever with `Spinner`
 * mounted above every other branch, which is just as fatal as never
 * reaching the app at all. This is the same shape of bug `app/_layout.tsx`
 * already had to close twice — once for a rejected `useFonts` call
 * (`fontError`) and once for one that never settles at all
 * (`bootTimedOut`) — so it gets the same fix here: `INTRO_READ_TIMEOUT_MS`
 * bounds how long this route will wait before treating the flag as "seen"
 * regardless of whether the read ever finishes. The functional `setState`
 * updater below only applies that fallback if the real read hasn't already
 * settled by the deadline, so a read that's merely slow (not hung) is never
 * clobbered by the timer racing it.
 *
 * The write-side half of this same fail-open reasoning lives in
 * `src/onboarding/introSeen.ts` (an in-memory guard set before the
 * persisted write is attempted) and `app/tanitim.tsx`'s `finish()` (which
 * swallows a write failure and always navigates onward) — together they
 * guarantee a failed flag write can never send this route back into the
 * tour in a loop.
 *
 * The `@/`-aliased imports above are a permanent guard, not incidental —
 * they are the only proof that Metro resolves the path alias at bundle
 * time, which CI's `expo export` step depends on. Keep at least one when
 * touching this file.
 */
export const INTRO_READ_TIMEOUT_MS = 2500;

export default function Index() {
  const { status, user } = useAuth();
  const [introSeen, setIntroSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (status !== "authed" || !user) return;
    hasSeenIntro().then(setIntroSeen, () => setIntroSeen(true));

    const timer = setTimeout(() => {
      setIntroSeen((current) => (current === undefined ? true : current));
    }, INTRO_READ_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, user]);

  if (status === "loading") return <Spinner />;
  if (status === "locked") return <LockedScreen />;
  if (status === "anon" || !user) return <Redirect href="/giris" />;

  if (introSeen === undefined) return <Spinner />;
  if (!introSeen) return <Redirect href="/tanitim" />;
  return <Redirect href={user.role === "accountant" ? "/(accountant)" : "/(client)"} />;
}
