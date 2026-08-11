import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthProvider";
import { LockedScreen } from "@/src/auth/LockedScreen";
import { hasSeenIntro } from "@/src/onboarding/introSeen";
import { Spinner } from "@/src/theme/components/Spinner";

/**
 * Role-based landing redirect: anon -> /giris (or /(auth)/tanitim first, on
 * a fresh install), an authed client -> the client tab group, an authed
 * accountant -> the accountant tab group, locked (opted into biometric
 * unlock but not yet unlocked) -> the locked screen instead of any
 * redirect.
 *
 * `hasSeenIntro()` is async, so an anon session can't be redirected on
 * first render — `introSeen` holds `undefined` until the read resolves and
 * a `Spinner` renders meanwhile, the same pattern used for
 * `status === "loading"`, so the login screen never flashes before the
 * tour. Only consulted for `anon`: a signed-in user must never see it.
 *
 * The `@/`-aliased imports above are a permanent guard, not incidental —
 * they are the only proof that Metro resolves the path alias at bundle
 * time, which CI's `expo export` step depends on. Keep at least one when
 * touching this file.
 */
export default function Index() {
  const { status, user } = useAuth();
  const [introSeen, setIntroSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (status !== "anon") return;
    hasSeenIntro().then(setIntroSeen);
  }, [status]);

  if (status === "loading") return <Spinner />;
  if (status === "locked") return <LockedScreen />;
  if (status === "anon" || !user) {
    if (introSeen === undefined) return <Spinner />;
    return <Redirect href={introSeen ? "/giris" : "/(auth)/tanitim"} />;
  }
  return <Redirect href={user.role === "accountant" ? "/(accountant)" : "/(client)"} />;
}
