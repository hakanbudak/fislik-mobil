import { router } from "expo-router";
import { CaptureScreen } from "@/src/features/upload/CaptureScreen";
import { currentPeriod } from "@/src/lib/period";

/**
 * Thin route wrapper around `<CaptureScreen>` — the client's own capture is
 * always filed under the current month, with no `clientId` (that's
 * Task 24's accountant-on-behalf route,
 * `app/(accountant)/mukellef/[clientId]/kamera.tsx`). See `CaptureScreen`
 * for why the burst-camera UI itself lives in one shared place.
 */
export default function KameraScreen() {
  return <CaptureScreen period={currentPeriod()} onClose={() => router.back()} />;
}
