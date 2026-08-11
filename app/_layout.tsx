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
import { SAFETY_TIMEOUT_MS, SplashOverlay } from "@/src/theme/components/SplashOverlay";
import { invalidateAfterUpload } from "@/src/upload/invalidateAfterUpload";
import { startWorker } from "@/src/upload/worker";

SplashScreen.preventAutoHideAsync();

// Module-scoped, not component state: guarantees the launch animation plays
// once per cold start even if `RootLayout` were ever remounted — it must
// never replay on a re-render or a navigation, both of which happen far
// more often than a real cold start. (How this interacts with an
// `ErrorBoundary` retry is explained at `showSplash` below.) One gap: Fast
// Refresh triggered by editing `_layout.tsx` itself re-evaluates this
// module and resets the flag, so the splash can replay in dev in that one
// case. Fast Refresh triggered by editing any *other* file does not
// re-evaluate this module, so the flag survives those.
let splashPlayed = false;

// Test-only escape hatch: without it, two tests in the same file that both
// render `RootLayout` with fonts loaded would share this module-scoped
// flag — whichever runs first "spends" it, so a second such test would see
// no splash and pass/fail for the wrong reason (and swapping test order
// would silently flip which one). `jest.resetModules()`/`jest.isolateModules`
// don't help here without also re-requiring React itself into an isolated
// registry, which breaks hook dispatch. See app/__tests__/splash.test.tsx.
export function __resetSplashPlayedForTests() {
  splashPlayed = false;
}

// Best available proxy for "launch started": the moment this module began
// evaluating, which is early in the JS bundle's execution and well before
// fonts resolve. Not the true native process-start time (no native module
// exposes that here), but close enough to bound the whole visible
// "loading" experience rather than just the splash animation's own
// mount-to-mount time.
const bootStartedAt = Date.now();
// The ~2.5s ceiling the design imposes applies to the whole launch (font
// load + splash animation), not to the animation alone — see
// `SplashOverlay`'s `deadline` prop.
const splashDeadline = bootStartedAt + SAFETY_TIMEOUT_MS;

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
  // `fontError` (previously discarded) matters: if font loading rejects,
  // `loaded` stays `false` forever. Left unhandled, that means `return
  // null` below never resolves, the native splash never hides (`hideAsync`
  // was gated on `loaded` alone), and the app is permanently stuck on a
  // blank screen — worse now than before this feature, since the native
  // splash used to at least show the branded mark and is now a plain teal
  // field indistinguishable from a hang. Treating `fontError` as "unblock
  // and render with system-font fallback" costs a cosmetic mismatch;
  // treating it as "still waiting" costs the app never launching. Same
  // asymmetry as this codebase's intro-flag fail-open.
  const [loaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const fontsSettled = loaded || !!fontError;

  // Created once via useState so re-renders never mint a second client.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );

  // Lazy init, and the flag is set here — at the moment we decide whether
  // to show the splash — rather than in `onDone` on completion. Setting it
  // on completion would mean a splash that crashes partway through (any
  // throw inside `SplashOverlay` surfaces `CrashScreen` via the
  // `ErrorBoundary` below, since the overlay renders inside the same tree
  // `Try` wraps) never marks itself "played", so `retry` remounts
  // `RootLayout` and shows the splash again — and if the same crash is
  // deterministic, that's an unrecoverable loop. Setting it at mount makes
  // `retry` an escape hatch: it always resumes at "app, no splash".
  const [showSplash, setShowSplash] = useState(() => {
    const shouldShow = !splashPlayed;
    splashPlayed = true;
    return shouldShow;
  });

  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync();
  }, [fontsSettled]);

  useEffect(
    () =>
      startWorker((receipt, requestedPeriod, clientId) =>
        invalidateAfterUpload(queryClient, receipt, requestedPeriod, clientId),
      ),
    [queryClient],
  );

  if (!fontsSettled) return null;
  return (
    // GestureHandlerRootView must be the outermost view or react-native-gesture-handler
    // receives no events on Android — the receipt viewer's pinch-to-zoom depends on it.
    // SafeAreaProvider sits inside it so every screen can reach the device insets.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={showSplash ? "light" : "dark"} />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Slot />
          </AuthProvider>
        </QueryClientProvider>
        {/* `loaded` (not just `fontsSettled`) gates the splash: it needs
            `font.extraBold` to render its wordmark faithfully, and a font
            error means there is nothing to seamlessly hand off from in the
            first place — skip straight to the (degraded-font) app instead
            of animating a broken wordmark. */}
        {showSplash && loaded && <SplashOverlay deadline={splashDeadline} onDone={() => setShowSplash(false)} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
