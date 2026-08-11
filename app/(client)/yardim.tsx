import { router } from "expo-router";
import { HelpContent } from "@/src/features/help/HelpContent";
import { resetIntro } from "@/src/onboarding/introSeen";

/**
 * "Nasıl kullanılır" — reachable from Profil (`app/(client)/profil.tsx`) at
 * any time, not just on first launch. Registered with `href: null` in
 * `_layout.tsx` so it stays a real, linkable route without leaking into
 * the tab bar, the same defect the `kamera`/`firma-bilgileri`/`fis/[id]`
 * entries there already guard against.
 *
 * `resetIntro()` deliberately doesn't swallow AsyncStorage errors — see its
 * docstring — so this call site swallows them itself, rather than pushing
 * that handling into the shared helper: a failed `removeItem` must not
 * strand the user on this screen, and navigation must still happen even
 * when it throws. Worst case on failure is the four-slide tour reappearing
 * on a later cold start, which is harmless; failing to navigate at all
 * would not be.
 */
export default function ClientYardimScreen() {
  return (
    <HelpContent
      role="client"
      onReplayIntro={async () => {
        try {
          await resetIntro();
        } catch {
          // See the docstring above — a failed reset must not block
          // navigation to the tour.
        } finally {
          router.replace("/(auth)/tanitim");
        }
      }}
    />
  );
}
