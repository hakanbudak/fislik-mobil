import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot, SplashScreen, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/auth/AuthProvider";
import { CrashScreen } from "@/src/theme/components/CrashScreen";
import { invalidateAfterUpload } from "@/src/upload/invalidateAfterUpload";
import { startWorker } from "@/src/upload/worker";

SplashScreen.preventAutoHideAsync();

/**
 * The root layout's crash boundary — expo-router wraps the WHOLE app in a
 * `Try` (see `expo-router/build/views/Try.js`) whenever its route file
 * exports a component named `ErrorBoundary`, catching anything thrown
 * anywhere in `<Slot />`'s subtree: both tab shells and their
 * `<ImpersonationBanner />`, every screen, `AuthProvider` itself.
 *
 * Note this is NOT `app/+error.tsx`. That filename looked right from the
 * expo-router docs' general "+file" convention, but this project's
 * expo-router version (~57.0.11) special-cases only `+not-found` — any
 * other `+`-prefixed file under `app/` throws `Invalid route ...: Route
 * nodes cannot start with the '+' character` while the route tree is built
 * (confirmed directly against `getRoutesCore.js`'s `getFileMeta`, see
 * task-27-report.md). The real per-route convention is a named
 * `ErrorBoundary` export from the route file itself; putting it on the root
 * layout makes it app-wide, matching what a top-level `+error.tsx` would
 * have covered.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Created once via useState so re-renders never mint a second client.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(
    () =>
      startWorker((receipt, requestedPeriod, clientId) =>
        invalidateAfterUpload(queryClient, receipt, requestedPeriod, clientId),
      ),
    [queryClient],
  );

  if (!loaded) return null;
  return (
    // GestureHandlerRootView must be the outermost view or react-native-gesture-handler
    // receives no events on Android — the receipt viewer's pinch-to-zoom depends on it.
    // SafeAreaProvider sits inside it so every screen can reach the device insets.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Slot />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
