import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "./AuthProvider";
import { LockedScreen } from "./LockedScreen";
import { Spinner } from "@/src/theme/components/Spinner";

/**
 * Route guard for the two protected tab groups, `(client)` and
 * `(accountant)`. Without it, `signOut()` (and the 401-driven forced
 * sign-out in `AuthProvider`) correctly clears the session but leaves
 * whichever screen is on-screen mounted — `status` flips to `"anon"` with
 * nothing to act on it, stranding the user on a signed-out shell.
 *
 * Branching mirrors `app/index.tsx`'s exactly, so the two can't drift:
 * `"loading"` -> `Spinner` (never a redirect — see below), `"locked"` ->
 * `LockedScreen`, `"anon"` -> `/giris`, anything else -> render the group.
 *
 * `app/index.tsx` doesn't render through this component even though its
 * first two branches read identically, because its remaining two branches
 * are genuinely different, not incidental duplication: its anon branch
 * defers to the first-launch intro flag instead of redirecting straight to
 * `/giris`, and its authed branch picks a role-specific tab group instead
 * of rendering fixed children. Sharing just the two-line loading/locked
 * shape would cost more indirection than the four lines it saves.
 *
 * Cold start: `status` is `"loading"` (not `"anon"`) until `AuthProvider`
 * finishes restoring the stored session and — if a token exists —
 * resolving `/me`. This guard shows `Spinner` for the entire window, so a
 * signed-in user deep-linked straight into a group route is never bounced
 * to `/giris` by a transient loading state; only a *settled* `"anon"`
 * status redirects.
 *
 * No redirect cycle: `/giris` lives outside both groups and isn't wrapped
 * by this guard, so an anon user redirected here lands on a screen that
 * doesn't redirect again.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <Spinner />;
  if (status === "locked") return <LockedScreen />;
  if (status === "anon") return <Redirect href="/giris" />;
  return <>{children}</>;
}
