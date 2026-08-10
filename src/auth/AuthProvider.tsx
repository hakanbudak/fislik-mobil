import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/src/api/client";
import { queryKeys } from "@/src/api/queryKeys";
import * as endpoints from "@/src/api/endpoints";
import type { AuthOut, Role, UserOut } from "@/src/api/endpoints";
import { clearSession, loadSession, saveSession } from "./session";
import { requestUnlock } from "./biometrics";

/** "locked" is added by Task 8 (biometric unlock) as an extra state layered
 *  on top of an already-authed session — never a replacement for it. */
export type Status = "loading" | "authed" | "anon" | "locked";

interface AuthValue {
  user: UserOut | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<UserOut>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    role: Role;
    invite_token?: string;
  }) => Promise<UserOut>;
  signOut: () => Promise<void>;
  /** Retries the biometric prompt from the locked screen; flips `status`
   *  back to "authed"/"anon" (via the normal derivation) on success. */
  retryUnlock: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [restored, setRestored] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    loadSession().then(async (token) => {
      setHasToken(Boolean(token));
      // Only a token that exists is worth gating — requestUnlock() itself
      // already no-ops (returns true) when the feature is off or the
      // device has no enrolled biometrics, so this stays a pure convenience
      // lock and never blocks the anon path.
      if (token) setLocked(!(await requestUnlock()));
      setRestored(true);
    });
  }, []);

  const me = useQuery({
    queryKey: queryKeys.me(),
    queryFn: endpoints.getMe,
    enabled: restored && hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // A stored token the server no longer accepts is worthless — drop it so the
  // user lands on the login screen instead of a permanently failing session.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      void clearSession().then(() => setHasToken(false));
    }
  }, [me.error]);

  const status: Status = !restored
    ? "loading"
    : locked
      ? "locked"
      : hasToken && me.isLoading
        ? "loading"
        : me.data
          ? "authed"
          : "anon";

  async function adopt(result: AuthOut): Promise<UserOut> {
    const { access_token, ...user } = result;
    await saveSession(access_token);
    setHasToken(true);
    queryClient.setQueryData(queryKeys.me(), user);
    return user;
  }

  const value: AuthValue = {
    user: me.data ?? null,
    status,
    signIn: async (email, password) => adopt(await endpoints.login({ email, password })),
    signUp: async (data) => adopt(await endpoints.register(data)),
    signOut: async () => {
      // Best-effort: the server call only clears a cookie we never use, so a
      // failure here must not strand the user in a signed-in shell.
      await endpoints.logout().catch(() => undefined);
      await clearSession();
      setHasToken(false);
      setLocked(false);
      queryClient.clear();
    },
    retryUnlock: async () => {
      setLocked(!(await requestUnlock()));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
