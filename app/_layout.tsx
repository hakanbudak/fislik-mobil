import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { queryKeys } from "@/src/api/queryKeys";
import { AuthProvider } from "@/src/auth/AuthProvider";
import { startWorker } from "@/src/upload/worker";

SplashScreen.preventAutoHideAsync();

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
      startWorker((receipt, requestedPeriod) => {
        // The receipt may have been re-filed into a different month, so
        // refresh both the month we aimed at and the one it landed in.
        for (const p of new Set([requestedPeriod, receipt.period])) {
          queryClient.invalidateQueries({ queryKey: queryKeys.receipts(p) });
          queryClient.invalidateQueries({ queryKey: queryKeys.summary(p) });
          queryClient.invalidateQueries({ queryKey: queryKeys.submission(p) });
        }
      }),
    [queryClient],
  );

  if (!loaded) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}
