import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthProvider";
import { Spinner } from "@/src/theme/components/Spinner";

/**
 * Role-based landing redirect: anon -> /giris, an authed client -> the
 * client tab group, an authed accountant -> the accountant tab group.
 *
 * The `@/`-aliased imports above are a permanent guard, not incidental —
 * they are the only proof that Metro resolves the path alias at bundle
 * time, which CI's `expo export` step depends on. Keep at least one when
 * touching this file.
 */
export default function Index() {
  const { status, user } = useAuth();
  if (status === "loading") return <Spinner />;
  if (status === "anon" || !user) return <Redirect href="/giris" />;
  return <Redirect href={user.role === "accountant" ? "/(accountant)" : "/(client)"} />;
}
