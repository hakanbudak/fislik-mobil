import { router, useLocalSearchParams } from "expo-router";
import { CaptureScreen } from "@/src/features/upload/CaptureScreen";
import { currentPeriod } from "@/src/lib/period";

/**
 * The accountant's "upload on this client's behalf" entry point (Task 24) —
 * for the client who hands over a shoebox instead of using the app. Thin
 * wrapper around the same `<CaptureScreen>` the client's own camera uses
 * (`app/(client)/kamera.tsx`); see that component's docstring for why.
 *
 * `period` comes from the route param the accountant's per-client month
 * screen (`../[clientId].tsx`) is currently viewing, NOT `currentPeriod()`
 * — a shoebox is exactly the case where the receipts are for a past month,
 * so captures must file into whatever month the accountant has open, same
 * as the web's `<UploadDropzone period={period} .../>` in
 * `AccountantMonthPage.tsx`. It falls back to `currentPeriod()` only for a
 * deep link that arrives with no period param.
 */
export default function AccountantKameraScreen() {
  const {
    clientId,
    period: periodParam,
    full_name: fullNameParam,
  } = useLocalSearchParams<{ clientId: string; period?: string; full_name?: string }>();
  const period = periodParam ?? currentPeriod();

  return (
    <CaptureScreen
      period={period}
      clientId={clientId}
      clientLabel={fullNameParam}
      onClose={() => router.back()}
    />
  );
}
