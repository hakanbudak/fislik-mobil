import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthProvider";
import { LockedScreen } from "@/src/auth/LockedScreen";
import { Spinner } from "@/src/theme/components/Spinner";

/**
 * Role-based landing redirect: anon -> /giris, an authed client -> the
 * client tab group, an authed accountant -> the accountant tab group,
 * locked (opted into biometric unlock but not yet unlocked) -> the locked
 * screen instead of any redirect.
 *
 * The `@/`-aliased imports above are a permanent guard, not incidental —
 * they are the only proof that Metro resolves the path alias at bundle
 * time, which CI's `expo export` step depends on. Keep at least one when
 * touching this file.
 */
export default function Index() {
  const { status, user } = useAuth();
  if (status === "loading") return <Spinner />;
  if (status === "locked") return <LockedScreen />;
  if (status === "anon" || !user) return <Redirect href="/giris" />;
  return <Redirect href={user.role === "accountant" ? "/(accountant)" : "/(client)"} />;
}
